const loginButton = document.getElementById('loginButton');
const emailInput = document.getElementById('loginEmail');
const passwordInput = document.getElementById('loginPassword');

if (loginButton && emailInput && passwordInput) {
  loginButton.addEventListener('click', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();  
    const password = passwordInput.value;

    if (!email || !password) {
      alert('Email and password are required.');
      return;
    }

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        // ✅ Store user identity for marketscan.js
        localStorage.setItem('userEmail', data.email || email);
        if (data.name) {
          localStorage.setItem('userName', data.name);
        }

        // Go to the cards page
        window.location.href = '/cards.html';
      } else {
        alert(`Login failed: Password or Email is incorrect`);
      }

    } catch (error) {
      console.error('Error during login:', error);
      alert('An error occurred during login. Please try again later.');
    }
  });
}

const signForm = document.getElementById('signupForm');
if (signForm) {
  signForm.addEventListener('submit', async (event) => {
    event.preventDefault();
        
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const name = document.getElementById('signupName').value;
    const password2 = document.getElementById('signupPassword2').value; 

    if (password !== password2) {
      alert("Passwords do not match");
      return;
    }

    const res = await fetch('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    if (res.ok) {
      alert("Account created! Please log in.");
      window.location.href = '/index.html';
    } else {
      alert("Signup failed");
    }
  });
}