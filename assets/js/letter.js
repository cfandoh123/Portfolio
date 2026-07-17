const CORRECT_PIN = "2002";

const pinGate = document.getElementById("pin-gate");
const pinForm = document.getElementById("pin-form");
const pinInputs = document.getElementById("pin-inputs");
const pinError = document.getElementById("pin-error");
const letter = document.getElementById("letter");
const digits = Array.from(document.getElementsByClassName("pin-digit"));

digits[0].focus();

for (let i = 0; i < digits.length; i++) {
    // Only digits, and hop to the next box once this one is filled
    digits[i].oninput = () => {
        digits[i].value = digits[i].value.replace(/[^0-9]/g, "");
        digits[i].classList.toggle("filled", digits[i].value !== "");
        clearError();

        if (digits[i].value !== "" && i < digits.length - 1) {
            digits[i + 1].focus();
        }
        if (enteredPin().length === digits.length) {
            checkPin();
        }
    }

    // Backspace on an empty box steps back to the previous one
    digits[i].onkeydown = (event) => {
        if (event.key === "Backspace" && digits[i].value === "" && i > 0) {
            digits[i - 1].focus();
            digits[i - 1].value = "";
            digits[i - 1].classList.remove("filled");
            event.preventDefault();
        }
        if (event.key === "ArrowLeft" && i > 0) {
            digits[i - 1].focus();
        }
        if (event.key === "ArrowRight" && i < digits.length - 1) {
            digits[i + 1].focus();
        }
    }

    digits[i].onfocus = () => {
        digits[i].select();
    }

    // Pasting the whole pin fills every box
    digits[i].onpaste = (event) => {
        event.preventDefault();
        const pasted = event.clipboardData.getData("text").replace(/[^0-9]/g, "");
        fillDigits(pasted);
    }
}

pinForm.onsubmit = (event) => {
    event.preventDefault();
    checkPin();
}

function enteredPin() {
    return digits.map((digit) => digit.value).join("");
}

function fillDigits(value) {
    for (let i = 0; i < digits.length; i++) {
        digits[i].value = value[i] || "";
        digits[i].classList.toggle("filled", digits[i].value !== "");
    }
    const next = Math.min(value.length, digits.length - 1);
    digits[next].focus();

    if (enteredPin().length === digits.length) {
        checkPin();
    }
}

function checkPin() {
    if (enteredPin() === CORRECT_PIN) {
        unlock();
    } else {
        rejectPin();
    }
}

function rejectPin() {
    pinError.textContent = "That's not it. Try again.";
    pinError.classList.add("visible");

    pinInputs.classList.add("shake");
    pinInputs.addEventListener("animationend", () => {
        pinInputs.classList.remove("shake");
    }, { once: true });

    fillDigits("");
}

function clearError() {
    pinError.classList.remove("visible");
}

function unlock() {
    clearError();
    pinGate.style.transition = "opacity 0.5s, transform 0.5s";
    pinGate.style.opacity = "0";
    pinGate.style.transform = "scale(0.96)";

    setTimeout(() => {
        pinGate.classList.add("hidden");
        letter.classList.remove("hidden");
        letter.classList.add("revealed");
    }, 500);
}

// Background hearts, kept sparse and faint so they stay atmosphere, not confetti
const heartLayer = document.getElementById("floating-hearts");
const HEART_COUNT = 8;

for (let i = 0; i < HEART_COUNT; i++) {
    const heart = document.createElement("div");
    heart.className = "floating-heart";
    heart.textContent = "❤";
    heart.style.left = Math.random() * 100 + "%";
    heart.style.fontSize = (9 + Math.random() * 14) + "px";
    heart.style.color = Math.random() > 0.5 ? "#d9536f" : "#f0a0b4";
    heart.style.animationDuration = (14 + Math.random() * 12) + "s";
    // stagger the first pass so they drift in gradually instead of arriving together
    heart.style.animationDelay = (i * 1.6 + Math.random() * 2) + "s";
    heartLayer.appendChild(heart);
}
