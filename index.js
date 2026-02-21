document.addEventListener("DOMContentLoaded", () => {

  // ========== CONFIGURAÇÃO ==========
  const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzJCLmuY5tUBlabAjN6CMmLtRo4nDXqKLTHccjZ1kwrvs4TOlGqcqD_f0qpxen4XANvuw/exec";

  const sectionFiles = [
    "./00-intro.html",
    "./01-identificacao.html",
    "./02-cadastro.html",
    "./03-inspecao.html",
    "./04-licenciamento.html",
    "./05-investigacao.html",
    "./06-acoes-educativas.html",
    "./07-outros.html",
  ];

  // ========== ERRO NA PÁGINA ==========
  function showErrorOnPage(message) {
    document.getElementById("sections").innerHTML =
      `<div class="erro-box">${message}</div>`;
  }

  // ========== ENVIAR PARA APPS SCRIPT ==========
  async function enviarFormulario(dados) {
    const resp = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(dados)
    });
    return await resp.json();
  }

  // ========== COLETAR DADOS ==========
  function coletarDados() {
    const dados = {};
    const form = document.getElementById("formBPA");

    form.querySelectorAll("input, select, textarea").forEach(field => {
      if (!field.name) return;

      let valor = field.value;

      if (field.type === "number") {
        valor = valor === "" ? 0 : parseInt(valor, 10);
        if (isNaN(valor)) valor = 0;
      }

      dados[field.name] = valor;
    });

    return dados;
  }

  // ========== PADRONIZAR CAMPOS NUMÉRICOS ==========
  document.addEventListener("blur", (e) => {
    if (e.target.type === "number") {
      if (e.target.value === "" || e.target.value === null) {
        e.target.value = "0";
      } else {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v)) e.target.value = v;
      }
    }
  }, true);

  // ========== CARREGAR SEÇÕES ==========
  async function loadSections() {
    const container = document.getElementById("sections");
    container.innerHTML = "";

    for (const file of sectionFiles) {
      try {
        const response = await fetch(file, { cache: "no-store" });
        if (!response.ok) continue;
        container.insertAdjacentHTML("beforeend", await response.text());
      } catch (err) {
        console.error("Erro ao carregar:", file, err);
      }
    }

    const steps = document.querySelectorAll(".step");
    if (!steps.length) {
      showErrorOnPage("Erro: nenhuma seção (.step) foi carregada.");
      return;
    }

    let currentStep = 0;

    const showStep = (index) => {
      steps.forEach(s => s.classList.remove("active"));
      steps[index]?.classList.add("active");

      const submitBtn = document.querySelector(".submit");
      if (submitBtn)
        submitBtn.style.display = index === steps.length - 1 ? "block" : "none";
    };

    showStep(currentStep);

    document.querySelectorAll(".next").forEach(btn => {
      btn.addEventListener("click", () => {
        const fields = steps[currentStep].querySelectorAll("input, select, textarea");

        for (let field of fields) {
          if (!field.checkValidity()) {
            field.reportValidity();
            return;
          }
        }

        if (currentStep < steps.length - 1) {
          currentStep++;
          showStep(currentStep);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });

    document.querySelectorAll(".prev").forEach(btn => {
      btn.addEventListener("click", () => {
        if (currentStep > 0) {
          currentStep--;
          showStep(currentStep);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });

    document.getElementById("formBPA").addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.querySelector(".submit");

      submitBtn.disabled = true;
      submitBtn.textContent = "⏳ Enviando...";

      try {
        const resultado = await enviarFormulario(coletarDados());
        if (!resultado.ok) throw new Error(resultado.erro);

        document.querySelector("form").innerHTML = `
          <div class="sucesso-box">
            ✔ Formulário enviado com sucesso!
            <a href="index.html">Clique aqui para voltar ao início.</a>
          </div>`;
      } catch (err) {
        alert("Erro ao enviar: " + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Enviar formulário";
      }
    });
  }

  // ========== PAINEL GERÊNCIA ==========
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btnPainelGerencia")) {
      window.location.href = "./painel_gerencia.html";
    }
  });

  // ========== DARK MODE ==========
  const btnDark = document.getElementById("btnDarkMode");

  if (localStorage.getItem("darkMode") === "on") {
    document.body.classList.add("dark");
    btnDark.textContent = "☼ Light Mode";
  }

  btnDark.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    btnDark.textContent = isDark ? "☼ Light Mode" : "☽ Dark Mode";
    localStorage.setItem("darkMode", isDark ? "on" : "off");
  });

  loadSections();
});
