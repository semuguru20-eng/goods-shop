(function () {
  var DISMISS_KEY = "installBannerDismissed";
  if (localStorage.getItem(DISMISS_KEY)) return;

  var isStandalone =
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;
  if (isStandalone) return;

  var ua = window.navigator.userAgent;
  var isIOS = /iPhone|iPad|iPod/i.test(ua);
  var isAndroid = /Android/i.test(ua);
  if (!isIOS && !isAndroid) return;

  var deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showBanner("android");
  });

  window.addEventListener("appinstalled", dismiss);

  if (isIOS) {
    window.addEventListener("load", function () {
      showBanner("ios");
    });
  }

  function showBanner(kind) {
    if (document.getElementById("install-banner")) return;

    var banner = document.createElement("div");
    banner.id = "install-banner";
    banner.className = "install-banner";

    var text = document.createElement("p");
    text.textContent =
      kind === "android"
        ? "홈 화면에 추가하면 더 빠르게 이용할 수 있어요."
        : "공유 버튼을 누른 뒤 '홈 화면에 추가'를 선택하면 앱처럼 이용할 수 있어요.";
    banner.appendChild(text);

    var actions = document.createElement("div");
    actions.className = "install-actions";

    if (kind === "android") {
      var installBtn = document.createElement("button");
      installBtn.className = "primary";
      installBtn.textContent = "홈 화면에 추가";
      installBtn.addEventListener("click", function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(dismiss);
      });
      actions.appendChild(installBtn);
    }

    var closeBtn = document.createElement("button");
    closeBtn.className = "secondary";
    closeBtn.textContent = "닫기";
    closeBtn.addEventListener("click", dismiss);
    actions.appendChild(closeBtn);

    banner.appendChild(actions);
    document.body.appendChild(banner);
    document.body.classList.add("has-install-banner");
  }

  function dismiss() {
    var banner = document.getElementById("install-banner");
    if (banner) banner.remove();
    document.body.classList.remove("has-install-banner");
    localStorage.setItem(DISMISS_KEY, "1");
  }
})();
