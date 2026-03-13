let currentPin = "1234";
let vaultData = [];

// ==========================================
// Triple DES (3DES) Simulation (EDE Principle)
// ==========================================
function tripleDesSim(text) {
    let e1 = btoa(text); // Stage 1: Encrypt
    let d2 = e1.split('').reverse().join(''); // Stage 2: Decrypt (Reverse)
    let e3 = btoa(d2).substring(0, 14).toUpperCase(); // Stage 3: Encrypt
    return "3DES-" + e3;
}

// ACCESS CONTROL
function checkLogin() {
    const entered = document.getElementById('pin-input').value;
    if (entered === currentPin) {
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        document.getElementById('pin-input').value = ""; 
    } else {
        document.getElementById('security-alert').classList.remove('hidden');
    }
}

function closeAlert() {
    document.getElementById('security-alert').classList.add('hidden');
}

function lockSystem() {
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-container').classList.remove('hidden');
}

// PIN MODAL LOGIC (New Feature)
function openPinModal() {
    document.getElementById('pin-modal').classList.remove('hidden');
}

function closePinModal() {
    document.getElementById('pin-modal').classList.add('hidden');
    document.getElementById('new-pin-field').value = "";
}

function saveNewPin() {
    const newPin = document.getElementById('new-pin-field').value;
    if (newPin !== "") {
        currentPin = newPin; // Updates the PIN in memory
        alert("Security Update Successful! Use your new code for the next login.");
        closePinModal();
    } else {
        alert("Action Denied: Field cannot be empty.");
    }
}

// INVENTORY MANAGEMENT
function addNewItem() {
    const name = document.getElementById('item-name').value;
    const serial = document.getElementById('item-serial').value;

    if (name && serial) {
        vaultData.push({
            equipment: name,
            encrypted: tripleDesSim(serial),
            decrypted: serial
        });
        document.getElementById('item-name').value = "";
        document.getElementById('item-serial').value = "";
        updateTable();
    }
}

function updateTable() {
    const list = document.getElementById('inventory-list');
    list.innerHTML = "";
    vaultData.forEach((item, index) => {
        list.innerHTML += `
            <tr>
                <td><strong>${item.equipment}</strong></td>
                <td style="font-family: monospace; color: #64748b;">${item.encrypted}</td>
                <td style="color: #10b981; font-weight: bold;">${item.decrypted}</td>
                <td><button onclick="removeItem(${index})" class="btn-delete-row">Delete</button></td>
            </tr>`;
    });
}

function removeItem(i) {
    vaultData.splice(i, 1);
    updateTable();
}