
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
    import { 
        getAuth, 
        signInWithEmailAndPassword, 
        createUserWithEmailAndPassword, 
        onAuthStateChanged, 
        signOut, 
        updatePassword,
        EmailAuthProvider,
        reauthenticateWithCredential
    } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
    import { 
        getFirestore, 
        doc, 
        onSnapshot, 
        updateDoc, 
        setDoc, 
        arrayUnion, 
        deleteField 
    } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

    
    const firebaseConfig = {
        apiKey: "AIzaSyAjJpK-3eNIXFM7V7dWLJhWua5T3fF3_2E",
        authDomain: "user-store-srt.firebaseapp.com",
        projectId: "user-store-srt",
        storageBucket: "user-store-srt.firebasestorage.app",
        messagingSenderId: "932714544224",
        appId: "1:932714544224:web:7ecaecb707b59b3b7d1705"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    let currentUID = null;
    let realtimeListener = null;
    let purchaseData = null;

    // ====================== AUTH STATE LISTENER ======================
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUID = user.uid;
            document.getElementById('displayEmail').innerText = user.email || "User";
            showMainUI('storeUI');
            startSync(user.uid);
            startTime();
        } else {
            if (realtimeListener) realtimeListener();
            currentUID = null;
            showMainUI('authSection');
        }
    });

    // ====================== SIDE MENU ======================
    const menuBtn = document.getElementById('menuBtn');
    const sideDrawer = document.getElementById('sideDrawer');
    const menuOverlay = document.getElementById('menuOverlay');

    const toggleMenu = () => {
        const isOpen = sideDrawer.classList.toggle('active');
        menuBtn.classList.toggle('active');
        menuOverlay.style.display = isOpen ? 'block' : 'none';
    };

    menuBtn.onclick = toggleMenu;
    menuOverlay.onclick = toggleMenu;

    // ====================== PASSWORD UPDATE (Fixed) ======================
    window.processPassUpdate = async () => {
        const oldP = document.getElementById('oldPass').value.trim();
        const newP = document.getElementById('newPass').value.trim();
        const user = auth.currentUser;

        if (!oldP || !newP) return alert("Please fill both old and new password!");
        if (newP.length < 6) return alert("New password must be at least 6 characters!");

        try {
            const credential = EmailAuthProvider.credential(user.email, oldP);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newP);

            alert("✅ Password updated successfully!");
            closeModals();
            document.getElementById('oldPass').value = '';
            document.getElementById('newPass').value = '';
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/wrong-password') {
                alert("❌ Old password is incorrect!");
            } else {
                alert("❌ Failed: " + error.message);
            }
        }
    };

    // ====================== REAL-TIME SYNC (Fixed) ======================
    function startSync(uid) {
        const userRef = doc(db, "users", uid);

        realtimeListener = onSnapshot(userRef, (snap) => {
            if (!snap.exists()) {
                setDoc(userRef, {
                    history: [],
                    adminMessage: "Welcome to SRT Premium Store!",
                    requestStatus: "Active"
                }, { merge: true });
                return;
            }

            const data = snap.data();

            // Update Status with color
            const statusEl = document.getElementById('userStatus');
            statusEl.innerText = data.requestStatus || "Active";

            if (data.requestStatus === "Approved") {
                statusEl.style.color = "#0f0";
            } else if (data.requestStatus === "Approval Pending") {
                statusEl.style.color = "orange";
            } else {
                statusEl.style.color = "#fff";
            }

            document.getElementById('adminMsg').innerText = data.adminMessage || "No messages from admin.";

            renderHistory(data.history || []);
        });
    }

    function renderHistory(history) {
        const container = document.getElementById('historyList');
        if (!history || history.length === 0) {
            container.innerHTML = `<p style="padding:20px; color:#888; text-align:center;">No purchase history yet.</p>`;
            return;
        }

        container.innerHTML = history.slice().reverse().map(item => `
            <div class="history-item">
                <small>${item.date || ''}</small>
                <p>${item.msg || item}</p>
            </div>
        `).join('');
    }

    // ====================== HISTORY DELETE ======================
    window.confirmDeleteHistory = () => {
        document.getElementById('deleteWarning').classList.remove('hidden');
    };

    window.hideDeleteWarning = () => {
        document.getElementById('deleteWarning').classList.add('hidden');
    };

    window.processHistoryDelete = async () => {
        if (!currentUID) return;
        try {
            await updateDoc(doc(db, "users", currentUID), { history: deleteField() });
            hideDeleteWarning();
            alert("✅ History cleared!");
        } catch (e) {
            alert("Failed to clear history.");
        }
    };

    // ====================== PRODUCT SELECTION ======================
    window.togglePrices = (id) => {
        const priceSection = document.getElementById(id);
        if (!priceSection) return;

        priceSection.classList.toggle('hidden');

        const arrow = event.currentTarget.querySelector('.arrow');
        if (arrow) {
            arrow.style.transform = priceSection.classList.contains('hidden') 
                ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    };

    window.selectItem = (el, name, price, duration) => {
    // सबै कार्डबाट 'active' क्लास हटाउने
    document.querySelectorAll('.price-card').forEach(c => c.classList.remove('active'));
    
    // छानिएको कार्डमा 'active' क्लास थप्ने
    el.classList.add('active');

    // purchaseData मा डाटा स्टोर गर्ने
    // यहाँ 'duration' भन्नाले ३० दिन वा ३ दिन भन्ने बुझिन्छ
    purchaseData = { 
        name: name, 
        price: price, 
        duration: duration,
        // अर्डर गरेको वास्तविक समय (Nepal Time) पनि यहीँ थपिदिउँ
        selectedAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' })
    };

    // Buy Button देखाउने
    const buyBtn = el.parentElement.querySelector('.buy-now-btn');
    if (buyBtn) buyBtn.classList.remove('hidden');

    // हल्का भाइब्रेट गराउने (मोबाइलको लागि)
    if (navigator.vibrate) navigator.vibrate(15);
};


    // ====================== CHECKOUT FLOW (FIXED) ======================
    window.startCheckout = () => {
        if (!purchaseData) return alert("Please select an item first!");
        openModal('checkoutModal');
        document.getElementById('checkoutStep1').classList.remove('hidden');
        document.getElementById('checkoutStep2').classList.add('hidden');
    };

    window.showQR = () => {
        const name = document.getElementById('payName').value.trim();
        const wa = document.getElementById('payWA').value.trim();

        if (!name || !wa) return alert("Please enter your Name and WhatsApp Number!");

        document.getElementById('checkoutStep1').classList.add('hidden');
        document.getElementById('checkoutStep2').classList.remove('hidden');

        let sec = 10;
        const btn = document.getElementById('finalPayBtn');
        btn.disabled = true;
        btn.classList.add('disabled');
        document.getElementById('timerSec').innerText = sec;

        const clock = setInterval(() => {
            sec--;
            document.getElementById('timerSec').innerText = sec;
            if (sec <= 0) {
                clearInterval(clock);
                btn.disabled = false;
                btn.classList.remove('disabled');
            }
        }, 1000);
    };

    // ====================== MAIN APPROVAL REQUEST (FIXED) ======================
    window.sendPurchase = async () => {
        if (!currentUID) return alert("Please login again.");
        if (!purchaseData) return alert("No item selected!");

        const name = document.getElementById('payName').value.trim();
        const wa = document.getElementById('payWA').value.trim();

        if (!name || !wa) return alert("Name and WhatsApp are required!");

        // पुरानो लाइन: const date = new Date().toLocaleString('en-IN');
// नयाँ कोड (नेपाल टाइमका लागि):

const options = { 
    timeZone: 'Asia/Kathmandu', 
    hour12: true, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
};

const date = new Date().toLocaleString('en-US', options); 
// यसले "May 1, 2024, 10:00:00 PM" जस्तो फर्म्याट दिन्छ

        const orderMsg = `Order: ${purchaseData.name} - Rs ${purchaseData.price}`;

        try {
            const userRef = doc(db, "users", currentUID);

            await updateDoc(userRef, {
                requestStatus: "Approval Pending",
                userName: name,
                whatsapp: wa,
                item: purchaseData.name,
                price: purchaseData.price,
                lastRequestTime: new Date().toISOString(),
                history: arrayUnion({
                    date: date,
                    msg: orderMsg,
                    item: purchaseData.name,
                    price: purchaseData.price
                })
            });

            alert("✅ Request Sent to Admin for Approval!");
            closeModals();

            // Reset
            purchaseData = null;
            document.getElementById('payName').value = '';
            document.getElementById('payWA').value = '';

        } catch (error) {
            console.error(error);
            alert("❌ Failed to send request. Try again.");
        }
    };

    // ====================== UI HELPERS ======================
    window.toggleAuth = (mode) => {
        document.getElementById('loginBox').classList.toggle('hidden', mode === 'signup');
        document.getElementById('signupBox').classList.toggle('hidden', mode === 'login');
    };

    function showMainUI(id) {
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('storeUI').classList.add('hidden');
        document.getElementById(id).classList.remove('hidden');
    }

    window.openModal = (id) => {
        document.getElementById('modalOverlay').classList.remove('hidden');
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('hidden');

        // Close menu when modal opens
        sideDrawer.classList.remove('active');
        menuBtn.classList.remove('active');
        menuOverlay.style.display = 'none';
    };

    window.closeModals = () => {
        document.getElementById('modalOverlay').classList.add('hidden');
    };

    // ====================== AUTH ACTIONS ======================
    document.getElementById('loginBtn').onclick = async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPass').value;

        if (!email || !pass) return alert("Please enter email and password");

        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (err) {
            alert("Login Failed: " + err.message);
        }
    };

    document.getElementById('signupBtn').onclick = async () => {
        const email = document.getElementById('regEmail').value.trim();
        const pass = document.getElementById('regPass').value;

        if (!email || !pass) return alert("Please fill all fields");
        if (pass.length < 6) return alert("Password must be at least 6 characters");

        try {
            await createUserWithEmailAndPassword(auth, email, pass);
            alert("✅ Account created successfully!");
        } catch (err) {
            alert("Signup Failed: " + err.message);
        }
    };

    window.handleLogout = () => signOut(auth);

    // ====================== LIVE CLOCK ======================
    function startTime() {
        setInterval(() => {
            const timeEl = document.getElementById('currentTime');
            if (timeEl) timeEl.innerText = new Date().toLocaleTimeString('en-IN');
        }, 1000);
    }


let lastSeenTime = localStorage.getItem('lastUpdate');

onSnapshot(doc(db, "users", currentUID), (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        const currentTime = data.processedAt; // एडमिनले पठाएको समय

        // यदि एडमिनले नयाँ अप्रुभल वा म्यासेज पठाएको छ भने
        if (currentTime && currentTime !== lastSeenTime) {
            showAutoPopup(data.requestStatus, data.adminMessage);
            lastSeenTime = currentTime;
            localStorage.setItem('lastUpdate', currentTime);
        }
    }
});


// ४. पपअप देखाउने फङ्सन
function showAutoPopup(status, msg) {
    const popup = document.getElementById('autoPopup');
    const msgArea = document.getElementById('popupMsg');

    if (popup && msgArea) {
        msgArea.innerHTML = `
            <h2 style="color:var(--primary); margin-bottom:10px;">${status}</h2>
            <div style="border:1.5px dashed var(--primary); padding:15px; border-radius:15px; background:rgba(0,240,255,0.05);">
                ${msg || "Admin has updated your status."}
            </div>
        `;
        popup.classList.remove('hidden'); // पपअप देखाउने
        
        // मोबाइलमा भाइब्रेट गराउने
        if (navigator.vibrate) navigator.vibrate(200);
    }
}

// ५. बटन थिच्दा पपअप बन्द गर्ने
window.closeAutoPopup = () => {
    document.getElementById('autoPopup').classList.add('hidden');
};

