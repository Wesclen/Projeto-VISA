const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzJCLmuY5tUBlabAjN6CMmLtRo4nDXqKLTHccjZ1kwrvs4TOlGqcqD_f0qpxen4XANvuw/exec";
const SENHA = "123";
const LIMIT = 50;

// ========== AUTENTICAÇÃO ==========
const senhaDigitada = prompt("🔐 Digite a senha da gerência:");
if (senhaDigitada !== SENHA) {
  document.body.innerHTML = "<div class='card'><h2 style='color:#d32f2f'>❌ Acesso negado</h2><p>Senha incorreta.</p></div>";
  throw new Error("Bloqueado");
}

let DATA_HEAD       = [];
let DATA_ROWS       = [];
let MODO_EDICAO     = false;
let CELULA_EDITANDO = null;
let SALVANDO        = false; // 🔥 Flag para bloquear duplo clique
let COL_OFFSET      = 0;

// ========== JSONP ==========
function jsonp(url) {
  return new Promise((res, rej) => {
    const cb = "cb" + Date.now() + Math.random().toString(36).slice(2);
    window[cb] = d => { delete window[cb]; s.remove(); res(d); };
    const s = document.createElement("script");
    s.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
    s.onerror = () => rej("Erro ao conectar com Google Sheets");
    document.body.appendChild(s);
  });
}

// ========== FORMATAÇÃO ==========
function formatarValor(valor) {
  if (valor === 0 || valor === "0") return "-";
  return valor ?? "";
}

function aplicarDestaque() {
  document.querySelectorAll('tbody td.valor-celula').forEach(cell => {
    const numero = parseFloat(cell.textContent.trim());
    cell.classList.toggle('valor-destaque', !isNaN(numero) && numero !== 0);
  });
}

// ========== RENDER TABELA ==========
function renderTabela(head, rows) {
  if (!head || head.length === 0 || !rows || rows.length === 0) {
    tabelaWrapUser.innerHTML = "<p style='padding:20px;text-align:center;color:#999'>Nenhum dado disponível</p>";
    return;
  }

  const idxMatricula = head.findIndex(h => h.toLowerCase() === "matricula");

  let html = '<table><thead><tr>';
  html += '<th>Campo</th>';
  rows.forEach((reg, i) => {
    const matricula = idxMatricula !== -1 ? reg[idxMatricula] : `Reg ${i + 1}`;
    html += `<th>${matricula || `Reg ${i + 1}`}</th>`;
  });
  html += '</tr></thead><tbody>';

  head.forEach((campo, fieldIdx) => {
    html += '<tr>';
    html += `<td><strong>${campo}</strong></td>`;

    rows.forEach((reg, regIdx) => {
      const valor          = formatarValor(reg[fieldIdx]);
      const colIdxAbsoluto = COL_OFFSET + regIdx;

      if (MODO_EDICAO) {
        html += `<td class="editavel valor-celula"
                    data-campo="${campo}"
                    data-colidx="${colIdxAbsoluto}"
                    data-field="${fieldIdx}">${valor}</td>`;
      } else {
        html += `<td class="valor-celula">${valor}</td>`;
      }
    });

    html += '</tr>';
  });

  html += '</tbody></table>';
  tabelaWrapUser.innerHTML = html;
  aplicarDestaque();
  if (MODO_EDICAO) aplicarEventosEdicao();
}

// ========== EDIÇÃO ==========
function aplicarEventosEdicao() {
  document.querySelectorAll('td.editavel').forEach(cell => {
    cell.addEventListener('click', function () {
      // 🔥 Bloqueia abertura de novo modal enquanto está salvando
      if (SALVANDO) return;

      const campo      = this.dataset.campo;
      const colIdx     = this.dataset.colidx;
      const valorAtual = this.textContent.trim();

      editCampo.value      = campo;
      editMatricula.value  = colIdx;
      editValorAtual.value = valorAtual === "-" ? "0" : valorAtual;
      editNovoValor.value  = valorAtual === "-" ? "0" : valorAtual;

      debugInfo.style.display = 'block';
      debugInfo.innerHTML = `Campo: "${campo}"<br>Coluna: ${colIdx}`;

      CELULA_EDITANDO = {
        elemento:    this,
        campo,
        colIdx,
        valorAntigo: valorAtual
      };

      modalEdicao.classList.add('ativo');
      editNovoValor.focus();
      editNovoValor.select();
    });
  });
}

async function salvarEdicao() {
  // 🔥 Captura snapshot imediato antes de qualquer await
  const snapshot = CELULA_EDITANDO;
  if (!snapshot) return;
  if (SALVANDO)  return;

  const novoValor = editNovoValor.value.trim();
  if (novoValor === "") { alert("⚠️ O valor não pode estar vazio"); return; }

  // 🔥 Fecha modal e bloqueia imediatamente
  SALVANDO = true;
  CELULA_EDITANDO = null;
  modalEdicao.classList.remove('ativo');

  statusUser.textContent = "💾 Salvando no Google Sheets...";
  statusUser.style.color = "#ff9800";

  try {
    const url = `${WEBAPP_URL}?senha=${encodeURIComponent(SENHA)}&action=editar`
      + `&colIdx=${encodeURIComponent(snapshot.colIdx)}`
      + `&campo=${encodeURIComponent(snapshot.campo)}`
      + `&valor=${encodeURIComponent(novoValor)}`;

    const resultado = await jsonp(url);

    if (resultado.ok) {
      // 🔥 Atualiza DATA_ROWS em memória
      const colIdx   = parseInt(snapshot.colIdx);
      const fieldIdx = parseInt(snapshot.elemento.dataset.field);
      if (DATA_ROWS[colIdx] !== undefined) {
        DATA_ROWS[colIdx][fieldIdx] = novoValor;
      }

      // 🔥 Atualiza a célula no DOM diretamente (sem re-renderizar)
      snapshot.elemento.textContent = formatarValor(novoValor);
      aplicarDestaque();

      statusUser.textContent = "✅ " + resultado.mensagem;
      statusUser.style.color = "#28a745";
    } else {
      throw new Error(resultado.erro || "Erro desconhecido");
    }
  } catch (err) {
    statusUser.textContent = "❌ Erro ao salvar: " + err;
    statusUser.style.color = "#d32f2f";
    // 🔥 Restaura valor original no DOM em caso de erro
    if (snapshot.elemento) {
      snapshot.elemento.textContent = snapshot.valorAntigo;
    }
  } finally {
    // 🔥 Libera o bloqueio sempre, mesmo em erro
    SALVANDO = false;
  }
}

// ========== COPIAR DADOS ==========
async function copiarDadosOriginais() {
  if (!confirm("⚠️ Isso vai SOBRESCREVER os dados editados com os originais.\n\nConfirma?")) return;

  statusUser.textContent = "📋 Copiando dados originais...";
  statusUser.style.color = "#ff9800";

  try {
    const resultado = await jsonp(`${WEBAPP_URL}?senha=${SENHA}&action=copiar_para_edicao`);
    if (resultado.ok) {
      statusUser.textContent = resultado.mensagem;
      statusUser.style.color = "#28a745";
      setTimeout(carregarTabela, 1500);
    } else {
      throw new Error(resultado.erro);
    }
  } catch (err) {
    statusUser.textContent = "❌ Erro ao copiar: " + err;
    statusUser.style.color = "#d32f2f";
  }
}

// ========== FILTRO ==========
function aplicarFiltro() {
  const campo = campoFiltro.value;
  const termo = filtroValor.value.trim().toLowerCase();

  if (!campo || !termo) {
    renderTabela(DATA_HEAD, DATA_ROWS);
    statusUser.textContent = `〽︎ Registros carregados: ${DATA_ROWS.length}`;
    statusUser.style.color = "#333";
    return;
  }

  const fieldIdx = DATA_HEAD.findIndex(h => h === campo);
  if (fieldIdx === -1) {
    statusUser.textContent = "❌ Campo não encontrado";
    statusUser.style.color = "#d32f2f";
    return;
  }

  const filtrados = DATA_ROWS.filter(reg =>
    String(reg[fieldIdx] ?? "").toLowerCase().includes(termo)
  );

  if (filtrados.length === 0) {
    statusUser.textContent = "❌ Nenhum registro encontrado";
    statusUser.style.color = "#d32f2f";
    tabelaWrapUser.innerHTML = "<p style='padding:20px;text-align:center;color:#999'>Nenhum resultado</p>";
    return;
  }

  renderTabela(DATA_HEAD, filtrados);
  statusUser.textContent = `✅ Registros encontrados: ${filtrados.length}`;
  statusUser.style.color = "#28a745";
}

function limparFiltro() {
  campoFiltro.value = "";
  filtroValor.value = "";
  renderTabela(DATA_HEAD, DATA_ROWS);
  statusUser.textContent = `〽︎ Registros carregados: ${DATA_ROWS.length}`;
  statusUser.style.color = "#333";
}

// ========== CARREGAR TABELA ==========
async function carregarTabela() {
  statusUser.textContent = "⧖ Carregando dados...";
  statusUser.style.color = "#ff99009d";
  tabelaWrapUser.innerHTML = "";
  DATA_HEAD  = [];
  DATA_ROWS  = [];
  COL_OFFSET = 0;

  try {
    const first = await jsonp(
      `${WEBAPP_URL}?senha=${SENHA}&action=listar&page=1&limit=${LIMIT}`
    );

    if (!first || !first.ok) {
      statusUser.textContent = "❌ " + (first?.erro || "Erro ao carregar dados");
      statusUser.style.color = "#d32f2f";
      return;
    }

    DATA_HEAD = first.head;
    DATA_ROWS = [...first.rows];

    for (let pg = 2; pg <= first.totalPages; pg++) {
      const d = await jsonp(
        `${WEBAPP_URL}?senha=${SENHA}&action=listar&page=${pg}&limit=${LIMIT}`
      );
      if (d && d.ok) DATA_ROWS.push(...d.rows);
    }

    COL_OFFSET = 0;

    renderTabela(DATA_HEAD, DATA_ROWS);
    statusUser.textContent = `✅ Registros carregados: ${DATA_ROWS.length}`;
    statusUser.style.color = "#28a745";

  } catch (err) {
    statusUser.textContent = "❌ Erro: " + err;
    statusUser.style.color = "#d32f2f";
  }
}

// ========== MODO EDIÇÃO ==========
function toggleModoEdicao() {
  MODO_EDICAO = !MODO_EDICAO;

  if (MODO_EDICAO) {
    btnModoEdicao.textContent = "🔒 Desativar Modo Edição";
    btnModoEdicao.classList.replace('btn-orange', 'btn-red');
    statusUser.textContent = "✎ MODO EDIÇÃO ATIVO - Clique nas células para editar";
    statusUser.style.color = "#ff9800";
  } else {
    btnModoEdicao.textContent = "🔓 Ativar Modo Edição";
    btnModoEdicao.classList.replace('btn-red', 'btn-orange');
    statusUser.textContent = `〽︎ Registros carregados: ${DATA_ROWS.length}`;
    statusUser.style.color = "#333";
  }

  renderTabela(DATA_HEAD, DATA_ROWS);
}

// ========== EVENTOS ==========
btnRecarregar.onclick   = carregarTabela;
btnCopiarDados.onclick  = copiarDadosOriginais;
btnLimparFiltro.onclick = limparFiltro;
btnModoEdicao.onclick   = toggleModoEdicao;
btnSalvarEdicao.onclick = salvarEdicao;

btnCancelarEdicao.onclick = () => {
  if (SALVANDO) return; // 🔥 Não cancela enquanto salva
  modalEdicao.classList.remove('ativo');
  CELULA_EDITANDO = null;
};

editNovoValor.addEventListener('keypress', e => {
  if (e.key === 'Enter') salvarEdicao();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalEdicao.classList.contains('ativo')) {
    if (SALVANDO) return; // 🔥 Não fecha com Esc enquanto salva
    modalEdicao.classList.remove('ativo');
    CELULA_EDITANDO = null;
  }
});

let timer;
filtroValor.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(aplicarFiltro, 300);
});

campoFiltro.addEventListener("change", () => {
  if (filtroValor.value.trim()) aplicarFiltro();
});

filtroValor.addEventListener("keypress", e => {
  if (e.key === "Enter") aplicarFiltro();
});

// Iniciar
carregarTabela();
console.log("Painel da Gerência carregado!");
