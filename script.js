// Start with the default PIN in memory
let currentPin = "1234";
let vaultData = [];

// ==========================================
// Triple DES (3DES) Simulation Logic
// ==========================================
function tripleDesSim(text) {
    let step1 = btoa(text); 
    let step2 = step1.split('').reverse().join(''); 
    let step3 = btoa(step2).substring(0, 14).toUpperCase(); 
    return "3DES-" + step3;
}

// This function now explicitly checks the UPDATED currentPin
function checkLogin() {
    const enteredPin = document.getElementById('pin-input').value;
    
    if (enteredPin === currentPin) {
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        // Clear the input so it's fresh for next time
        document.getElementById('pin-input').value = "";
    } else {
        document.getElementById('security-alert').classList.remove('hidden');
    }
}

function closeAlert() {
    document.getElementById('security-alert').classList.add('hidden');
    document.getElementById('pin-input').value = "";
}

// --- NEW LOCK FUNCTION ---
// This hides the dashboard and shows the login screen WITHOUT refreshing
function lockSystem() {
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-container').classList.remove('hidden');
}

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

function updatePin() {
    const newPinInput = document.getElementById('new-pin-val').value;
    if(newPinInput) {
        currentPin = newPinInput; // Updates the variable in RAM
        alert("Success! The system PIN has been changed to: " + currentPin);
        document.getElementById('new-pin-val').value = "";
    } else {
        alert("Please enter a value.");
    }
}