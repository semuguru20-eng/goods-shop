const ADMIN_EMAIL = "admin@admin.com";

async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function requireLogin(redirectTo = "login.html") {
  const session = await getSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}

async function requireAdmin() {
  const session = await requireLogin();
  if (!session) return null;
  if (session.user.email !== ADMIN_EMAIL) {
    alert("관리자만 접근할 수 있는 페이지입니다.");
    window.location.href = "products.html";
    return null;
  }
  return session;
}

async function renderNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  const session = await getSession();
  if (session) {
    const adminLink = session.user.email === ADMIN_EMAIL
      ? `<a href="admin.html">관리자</a>`
      : "";
    nav.innerHTML = `
      <a href="products.html">상품</a>
      <a href="mypage.html">내 결제내역</a>
      ${adminLink}
      <span class="nav-email">${session.user.email}</span>
      <button id="logout-btn">로그아웃</button>
    `;
    document.getElementById("logout-btn").addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "login.html";
    });
  } else {
    nav.innerHTML = `<a href="products.html">상품</a><a href="login.html">로그인</a>`;
  }
}

renderNav();
