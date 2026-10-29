const DASHBOARD_URL = "dashboard.html";
const LOGIN_API_URL = "http://127.0.0.1:5000/api/login";

document.addEventListener("DOMContentLoaded", function () {

    const loginForm = document.getElementById("loginForm");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const loginButton = document.getElementById("loginButton");
    const loginError = document.getElementById("loginError");
    const togglePassword = document.getElementById("togglePassword");

    togglePassword.addEventListener("click", function () {

        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            togglePassword.textContent = "🙈";
        } else {
            passwordInput.type = "password";
            togglePassword.textContent = "👁";
        }

    });

    loginForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        loginError.textContent = "";

        if (username === "" || password === "") {

            loginError.textContent =
                "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.";

            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = "Đang đăng nhập...";

        try {

            const response = await fetch(LOGIN_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const data = await response.json();

            if (!response.ok || data.status !== "success") {

                loginError.textContent =
                    data.message ||
                    "Tên đăng nhập hoặc mật khẩu không đúng.";

                loginButton.disabled = false;
                loginButton.textContent = "Đăng nhập";

                return;
            }

            sessionStorage.setItem(
                "beautyprice_logged_in",
                "true"
            );

            sessionStorage.setItem(
                "beautyprice_role",
                data.user.role
            );

            sessionStorage.setItem(
                "beautyprice_username",
                data.user.username
            );

            sessionStorage.setItem(
                "beautyprice_token",
                data.token
            );

            sessionStorage.setItem(
                "beautyprice_permissions",
                JSON.stringify(data.permissions)
            );

            window.location.href = DASHBOARD_URL;

        } catch (error) {

            console.error("Lỗi đăng nhập:", error);

            loginError.textContent =
                "Không thể kết nối đến máy chủ. Vui lòng kiểm tra Backend.";

            loginButton.disabled = false;
            loginButton.textContent = "Đăng nhập";
        }

    });

});
