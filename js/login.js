let mode = "login";

const tabLogin = document.getElementById("tab-login");
const tabSignup = document.getElementById("tab-signup");
const submitBtn = document.getElementById("submit-btn");
const errorMsg = document.getElementById("error-msg");
const infoMsg = document.getElementById("info-msg");

tabLogin.addEventListener("click", () => {
  mode = "login";
  tabLogin.classList.add("active");
  tabSignup.classList.remove("active");
  submitBtn.textContent = "로그인";
  errorMsg.textContent = "";
  infoMsg.textContent = "";
});

tabSignup.addEventListener("click", () => {
  mode = "signup";
  tabSignup.classList.add("active");
  tabLogin.classList.remove("active");
  submitBtn.textContent = "회원가입";
  errorMsg.textContent = "";
  infoMsg.textContent = "";
});

document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMsg.textContent = "";
  infoMsg.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (mode === "signup") {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      errorMsg.textContent = error.message;
      return;
    }
    infoMsg.textContent = "회원가입 완료! 자동으로 로그인됩니다.";
    setTimeout(() => (window.location.href = "products.html"), 800);
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      errorMsg.textContent = error.message;
      return;
    }
    window.location.href = "products.html";
  }
});
