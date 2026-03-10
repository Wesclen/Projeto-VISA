// ================= CONFIG =================
const CONFIG = {
  WEBAPP_URL: "https://script.google.com/macros/s/AKfycbzJCLmuY5tUBlabAjN6CMmLtRo4nDXqKLTHccjZ1kwrvs4TOlGqcqD_f0qpxen4XANvuw/exec",
  SENHA: "123",
  LIMIT: 50
};

// ================= STATE =================
const STATE = {
  head: [],
  rowsOriginal: [],
  rowsVisiveis: [],
  filtro: { campo: "", termo: "" },
  modoEdicao: false,
  salvando: false,
  celulaEditando: null,
  dashboardWindow: null
};

// ================= DOM =================
const DOM = {
  tabelaWrap: document.getElementById("tabelaWrapUser"),
  status: document.getElementById("statusUser"),
  campoFiltro: document.getElementById("campoFiltro"),
  filtroValor: document.getElementById("filtroValor"),

  btnRecarregar: document.getElementById("btnRecarregar"),
  btnCopiar: document.getElementById("btnCopiarDados"),
  btnModoEdicao: document.getElementById("btnModoEdicao"),
  btnLimpar: document.getElementById("btnLimparFiltro"),
  btnDashboard: document.getElementById("btnDashboard"),

  modal: document.getElementById("modalEdicao"),
  editCampo: document.getElementById("editCampo"),
  editValorAtual: document.getElementById("editValorAtual"),
  editNovoValor: document.getElementById("editNovoValor"),
  btnSalvar: document.getElementById("btnSalvarEdicao"),
  btnCancelar: document.getElementById("btnCancelarEdicao"),

  totalRespostas: document.getElementById("totalRespostas")
};

// ================= AUTH =================
const senhaDigitada = prompt("🔐 Digite a senha da gerência:");
if (senhaDigitada !== CONFIG.SENHA) {
  document.body.innerHTML = "<h2 style='color:red'>Acesso negado</h2>";
  throw new Error("Acesso bloqueado");
}

// ================= JSONP =================
function jsonp(url) {
  return new Promise((res, rej) => {
    const cb = "cb_" + Date.now();
    window[cb] = d => {
      delete window[cb];
      script.remove();
      res(d);
    };
    const script = document.createElement("script");
    script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
    script.onerror = () => {
      delete window[cb];
      script.remove();
      rej(new Error("Erro no JSONP"));
    };
    document.body.appendChild(script);
  });
}

// ================= API =================
const api = {
  listar: page =>
    jsonp(`${CONFIG.WEBAPP_URL}?senha=${CONFIG.SENHA}&action=listar&page=${page}&limit=${CONFIG.LIMIT}`),

  editar: ({ campo, colIdx, valor }) =>
    jsonp(`${CONFIG.WEBAPP_URL}?senha=${CONFIG.SENHA}&action=editar&campo=${encodeURIComponent(campo)}&colIdx=${colIdx}&valor=${encodeURIComponent(valor)}`),

  copiar: () =>
    jsonp(`${CONFIG.WEBAPP_URL}?senha=${CONFIG.SENHA}&action=copiar_para_edicao`)
};

// ================= UTIL =================
function formatarValor(v) {
  return v === 0 || v === "0" ? "-" : (v ?? "");
}

// ================= SOMA DAS PERGUNTAS =================
function somarPergunta(colIdx) {

  const nomeColuna = STATE.head[colIdx] || "";

  // Detecta código tipo 01.02.01.007-2 ou 01.2.01.036-6
  const ehPergunta = /\d{2}\.\d{1,2}\.\d{2}\.\d{3}-\d/.test(nomeColuna);

  // se não for pergunta, não soma
  if (!ehPergunta) return "";

  let total = 0;

  STATE.rowsVisiveis.forEach(r => {
    const n = Number(r[colIdx]);
    if (!isNaN(n)) total += n;
  });

  return total;
}

// ================= INDICADOR =================
function atualizarIndicador() {
  let total = 0;
  STATE.head.forEach((campo, idx) => {
    if (!campo.startsWith("Informe a quantidade")) return;
    STATE.rowsVisiveis.forEach(r => {
      const n = Number(r[idx]);
      if (!isNaN(n) && n > 0) total += n;
    });
  });
  DOM.totalRespostas.textContent = total;
}

// ================= RENDER TABELA =================
function renderTabela() {
  if (!STATE.head.length) return;

  const idxMat = STATE.head.indexOf("Matricula");
  let html = "<table><thead><tr><th>Campo</th><th>Total</th>";

  STATE.rowsVisiveis.forEach((r, i) => {
    html += `<th>${r[idxMat] || `Reg ${i + 1}`}</th>`;
  });

  html += "</tr></thead><tbody>";

  STATE.head.forEach((campo, fIdx) => {

    const totalPergunta = somarPergunta(fIdx);

    html += `<tr>
    <td><strong>${campo}</strong></td>
    <td><strong>${totalPergunta}</strong></td>`;

    STATE.rowsVisiveis.forEach((reg, rIdx) => {
      const v = formatarValor(reg[fIdx]);
      html += STATE.modoEdicao
        ? `<td class="editavel" data-row="${rIdx}" data-field="${fIdx}">${v}</td>`
        : `<td>${v}</td>`;
    });

    html += "</tr>";
  });

  html += "</tbody></table>";
  DOM.tabelaWrap.innerHTML = html;

  atualizarIndicador();
}

// ================= FILTRO =================
function aplicarFiltro() {
  const { campo, termo } = STATE.filtro;

  if (!campo || !termo) {
    STATE.rowsVisiveis = [...STATE.rowsOriginal];
  } else {
    const idx = STATE.head.indexOf(campo);
    STATE.rowsVisiveis = STATE.rowsOriginal.filter(r =>
      String(r[idx] ?? "").toLowerCase().includes(termo.toLowerCase())
    );
  }

  renderTabela();
  atualizarDashboardAvancado();
}

// ================= EDIÇÃO =================
DOM.tabelaWrap.addEventListener("click", e => {
  if (!STATE.modoEdicao || STATE.salvando) return;
  const cell = e.target.closest("td.editavel");
  if (!cell) return;

  STATE.celulaEditando = {
    row: +cell.dataset.row,
    field: +cell.dataset.field
  };

  DOM.editCampo.value = STATE.head[STATE.celulaEditando.field];
  DOM.editValorAtual.value = cell.textContent;
  DOM.editNovoValor.value = cell.textContent === "-" ? "0" : cell.textContent;
  DOM.modal.classList.add("ativo");
});

DOM.btnSalvar.onclick = async () => {
  if (!STATE.celulaEditando) return;

  const { row, field } = STATE.celulaEditando;
  const valor = DOM.editNovoValor.value.trim();

  STATE.salvando = true;
  DOM.modal.classList.remove("ativo");

  try {
    await api.editar({
      campo: STATE.head[field],
      colIdx: STATE.rowsOriginal.indexOf(STATE.rowsVisiveis[row]),
      valor
    });

    const originalRow = STATE.rowsOriginal[STATE.rowsOriginal.indexOf(STATE.rowsVisiveis[row])];
    originalRow[field] = valor;

    aplicarFiltro();
  } catch (err) {
    alert("Erro ao salvar: " + err.message);
  }

  STATE.salvando = false;
  STATE.celulaEditando = null;
};

DOM.btnCancelar.onclick = () => {
  DOM.modal.classList.remove("ativo");
  STATE.celulaEditando = null;
};

// ================= DASHBOARD =================
function abrirDashboard() {
  if (STATE.dashboardWindow && !STATE.dashboardWindow.closed) {
    STATE.dashboardWindow.focus();
    atualizarDashboardAvancado();
    return;
  }

  const w = window.open("", "_blank", "width=1400,height=800");
  STATE.dashboardWindow = w;

  w.document.write(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Dashboard Vertical</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  body { font-family: Arial; margin:20px; background:#f4f6f9; }
  canvas { width:100%; max-height:600px; }
  .card { background:#fff; padding:20px; border-radius:8px; margin-bottom:20px; }
  .filtro { margin-bottom:20px; }
</style>
</head>
<body>
<h2>📊 Dashboard Vertical</h2>
<div class="card">Total de respostas: <strong id="total"></strong></div>

<div class="filtro">
  <label>Ano: <select id="filtroAno"></select></label>
  <label>Mês: <select id="filtroMes"></select></label>
  <label>Setor: <select id="filtroSetor"></select></label>
</div>

<canvas id="grafico"></canvas>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<script>
let chart;
let dadosRecebidos = null;

function preencherFiltros(dados) {
  const anos = [...new Set(dados.map(r => r.ano))].sort();
  const meses = [...new Set(dados.map(r => r.mes))];

  const selAno = document.getElementById("filtroAno");
  const selMes = document.getElementById("filtroMes");
  const selSetor = document.getElementById("filtroSetor");

  selAno.innerHTML = "<option value=''>Todos</option>" + anos.map(a => "<option>"+a+"</option>").join("");
  selMes.innerHTML = "<option value=''>Todos</option>" + meses.map(m => "<option>"+m+"</option>").join("");
  selSetor.innerHTML = "<option value=''>Todos</option>" + [...new Set(dados.map(r => r.setor))].map(s => "<option>"+s+"</option>").join("");

  selAno.onchange = selMes.onchange = selSetor.onchange = atualizarGrafico;
}

function atualizarGrafico() {
  if (!dadosRecebidos) return;

  const anoSel = document.getElementById("filtroAno").value;
  const mesSel = document.getElementById("filtroMes").value;
  const setorSel = document.getElementById("filtroSetor").value;

  const filtered = dadosRecebidos.filter(r => 
    (anoSel === "" || r.ano == anoSel) &&
    (mesSel === "" || r.mes == mesSel) &&
    (setorSel === "" || r.setor == setorSel)
  );

  const perguntas = [...new Set(filtered.map(r => r.pergunta))];
  const meses = [...new Set(filtered.map(r => r.mes))].sort();

  const datasets = meses.map((m, idx) => ({
    label: m,
    data: perguntas.map(p => {
      const item = filtered.find(r => r.pergunta==p && r.mes==m);
      return item ? item.valor : 0;
    }),
    backgroundColor: \`hsl(\${idx*60 % 360},70%,50%)\`
  }));

  const ctx = document.getElementById("grafico");

  if (chart) {
    chart.destroy();
    ctx.height = 600;
  }

  chart = new Chart(ctx, {
    type: 'bar',
    data: { labels: perguntas, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { stacked: false },
        y: { stacked: false, beginAtZero: true, ticks: { precision:0 } }
      }
    }
  });
}

window.addEventListener("message", e => {
  if (!e.data?.type || e.data.type !== "DADOS_AVANCADOS") return;

  dadosRecebidos = e.data.rows;

  document.getElementById("total").textContent = e.data.total;
  preencherFiltros(dadosRecebidos);
  atualizarGrafico();
});

window.onload = () => {
  window.opener && window.opener.postMessage({ type: 'DASH_READY' }, "*");
};
</script>

</body>
</html>
  `);
  w.document.close();
}

// ================= ESCUTA DASHBOARD =================
window.addEventListener("message", e => {
  if (e.data?.type === "DASH_READY") {
    atualizarDashboardAvancado();
  }
});

// ================= ATUALIZAR DASHBOARD =================
function atualizarDashboardAvancado() {
  if (!STATE.dashboardWindow || STATE.dashboardWindow.closed) return;

  const idxMes = STATE.head.indexOf("Mes_Competencia");
  const idxAno = STATE.head.indexOf("Ano_Competencia");
  const idxSetor = STATE.head.indexOf("Setor_Nucleo");

  if (idxMes === -1) return;

  const colPerguntas = STATE.head
    .map((c, i) => ({ c, i }))
    .filter(c => c.c.startsWith("Informe a quantidade"));

  const rows = [];

  STATE.rowsVisiveis.forEach(r => {
    const ano = idxAno !== -1 ? r[idxAno] || "N/I" : "N/I";
    const mes = r[idxMes] || "N/I";
    const setor = idxSetor !== -1 ? r[idxSetor] || "N/I" : "N/I";

    colPerguntas.forEach(p => {
      const valor = Number(r[p.i]) || 0;
      rows.push({ 
        ano, 
        mes, 
        setor,
        pergunta: p.c, 
        valor 
      });
    });
  });

  const totalRespostas = rows.reduce((acc, r) => acc + r.valor, 0);

  STATE.dashboardWindow.postMessage({
    type: "DADOS_AVANCADOS",
    total: totalRespostas,
    rows
  }, "*");
}

// ================= LOAD =================
async function carregar() {
  DOM.status.textContent = "⧖ Carregando...";

  try {
    const first = await api.listar(1);
    console.log("Resposta do servidor:", first);

    STATE.head = first.head;
    STATE.rowsOriginal = [...first.rows];

    for (let i = 2; i <= first.totalPages; i++) {
      const p = await api.listar(i);
      STATE.rowsOriginal.push(...p.rows);
    }

    STATE.rowsVisiveis = [...STATE.rowsOriginal];
    renderTabela();
    DOM.status.textContent = `✅ ${STATE.rowsOriginal.length} registros`;
    atualizarDashboardAvancado();
  } catch (err) {
    DOM.status.textContent = "❌ Erro ao carregar dados";
    console.error("Erro detalhado:", err);
  }
}

// ================= EVENTOS =================
DOM.btnModoEdicao.onclick = () => {
  STATE.modoEdicao = !STATE.modoEdicao;
  renderTabela();
};

DOM.btnRecarregar.onclick = carregar;

DOM.btnCopiar.onclick = async () => {
  await api.copiar();
  carregar();
};

DOM.btnLimpar.onclick = () => {
  DOM.campoFiltro.value = "";
  DOM.filtroValor.value = "";
  STATE.filtro = { campo: "", termo: "" };
  aplicarFiltro();
};

DOM.filtroValor.addEventListener("input", () => {
  STATE.filtro.campo = DOM.campoFiltro.value;
  STATE.filtro.termo = DOM.filtroValor.value;
  aplicarFiltro();
});

if (DOM.btnDashboard) {
  DOM.btnDashboard.onclick = abrirDashboard;
}

// ================= INIT =================
carregar();
