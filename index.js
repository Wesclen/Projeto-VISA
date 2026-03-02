document.addEventListener("DOMContentLoaded", () => {

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

  const form = document.getElementById("formBPA");
  const container = document.getElementById("sections");

  // =========================
  // ENVIAR PARA APPS SCRIPT
  // =========================
  async function enviarFormulario(dados) {
    const resp = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(dados)
    });
    return await resp.json();
  }

  // =========================
  // COLETAR DADOS
  // =========================
  function coletarDados() {
    const dados = {};

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

  // =========================
  // GERAR RESUMO
  // =========================
  function gerarResumo() {
    const conteudo = document.getElementById("conteudoResumo");
    conteudo.innerHTML = "";

    const steps = document.querySelectorAll(".step");

    steps.forEach(step => {
      const titulo = step.querySelector("h2")?.textContent;
      const fields = step.querySelectorAll("input, select, textarea");

      const secao = document.createElement("div");
      secao.classList.add("resumo-secao");

      const h3 = document.createElement("h3");
      h3.textContent = titulo;
      secao.appendChild(h3);

      fields.forEach(field => {
        if (!field.name) return;

        const label = step.querySelector(`label[for="${field.id}"]`) 
                    || field.previousElementSibling;

        const pergunta = label ? label.textContent : field.name;
        const resposta = field.value || "—";

        const item = document.createElement("div");
        item.classList.add("resumo-item");

        item.innerHTML = `
          <div class="pergunta">${pergunta}</div>
          <div class="resposta"><span>${resposta}</span></div>
        `;

        secao.appendChild(item);
      });

      conteudo.appendChild(secao);
    });
  }

  // =========================
  // CARREGAR SEÇÕES
  // =========================
  async function loadSections() {

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
    let currentStep = 0;

    function showStep(index) {
      steps.forEach(s => s.classList.remove("active"));
      steps[index]?.classList.add("active");
    }

    showStep(currentStep);

    // =========================
    // BOTÃO NEXT
    // =========================
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

    // =========================
    // BOTÃO VOLTAR
    // =========================
    document.querySelectorAll(".prev").forEach(btn => {
      btn.addEventListener("click", () => {
        if (currentStep > 0) {
          currentStep--;
          showStep(currentStep);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });

    // =========================
    // FINALIZAR (ABRE MODAL)
    // =========================
    const btnFinalizar = document.getElementById("btnFinalizar");
    const modal = document.getElementById("modalResumo");

    btnFinalizar.addEventListener("click", () => {

      const fields = steps[currentStep].querySelectorAll("input, select, textarea");

      for (let field of fields) {
        if (!field.checkValidity()) {
          field.reportValidity();
          return;
        }
      }

      gerarResumo();
      modal.style.display = "flex";
    });

    // =========================
    // CANCELAR MODAL
    // =========================
    document.getElementById("cancelarEnvio").addEventListener("click", () => {
      modal.style.display = "none";
    });

    // =========================
    // CONFIRMAR ENVIO
    // =========================
    document.getElementById("confirmarEnvio").addEventListener("click", () => {
      modal.style.display = "none";
      form.requestSubmit();
    });

    // =========================
    // SUBMIT ORIGINAL
    // =========================
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById("btnFinalizar");
      submitBtn.disabled = true;
      submitBtn.textContent = "⏳ Enviando...";

      try {
        const resultado = await enviarFormulario(coletarDados());
        if (!resultado.ok) throw new Error(resultado.erro);

        form.innerHTML = `
          <div class="sucesso-box">
            ✔ Formulário enviado com sucesso!
            <br><br>
            <a href="index.html">Clique aqui para voltar ao início.</a>
          </div>`;
      } catch (err) {
        alert("Erro ao enviar: " + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Finalizar";
      }
    });

  }

  loadSections();
});
document.addEventListener("click", (e) => {
    if (e.target.closest("#btnPainelGerencia")) {
      window.location.href = "./painel_gerencia.html";
    }
  });
