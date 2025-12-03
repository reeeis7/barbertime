// app.js - lógica da interface e integração com api.js

function gerarHorariosValidos() {
  const horarios = [];
  let inicio = 9 * 60; // 09:00
  const fim = 18 * 60; // 18:00

  while (inicio <= fim) {
    const hora = Math.floor(inicio / 60);
    const minuto = inicio % 60;

    const horaStr = `${String(hora).padStart(2, "0")}:${String(minuto).padStart(
      2,
      "0"
    )}`;

    // pular horário de almoço
    if (horaStr >= "12:00" && horaStr < "13:00") {
      inicio += 40;
      continue;
    }

    // garantir apenas horários dentro da janela
    if (horaStr >= "09:00" && horaStr <= "18:00") {
      horarios.push(horaStr);
    }

    inicio += 40; // incrementa 40 minutos
  }

  return horarios;
}

// DOM elements
const tabs = document.querySelectorAll(".tab");
const contentSections = document.querySelectorAll(".content-section");
const btnAgendar = document.getElementById("btnAgendar");
const listaAgendamentos = document.getElementById("listaAgendamentos");
const tabelaAgendamentos = document.getElementById("tabelaAgendamentos");
const mesRelatorio = document.getElementById("mesRelatorio");
const breakdownServicos = document.getElementById("breakdownServicos");
const calendarioSemanal = document.getElementById("calendarioSemanal");

const receitaHoje = document.getElementById("receitaHoje");
const receitaSemana = document.getElementById("receitaSemana");
const receitaMes = document.getElementById("receitaMes");
const totalAgendamentos = document.getElementById("totalAgendamentos");
const receitaTotal = document.getElementById("receitaTotal");
const totalServicos = document.getElementById("totalServicos");
const clientesAtendidos = document.getElementById("clientesAtendidos");
const ticketMedio = document.getElementById("ticketMedio");

// Variáveis globais
let agendamentos = [];
let filtrosAtuais = {
  status: 'todos',
  busca: ''
};

// inicialização
document.addEventListener("DOMContentLoaded", async () => {
  const now = new Date();
  document.getElementById("currentDate").textContent = formatarData(now);
  document.getElementById("dataAgendamento").valueAsDate = now;
  mesRelatorio.value = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;

  // Inicializar horários
  const selectHora = document.getElementById("horaAgendamento");
  const horarios = gerarHorariosValidos();
  selectHora.innerHTML = "";
  horarios.forEach((h) => {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = h;
    selectHora.appendChild(opt);
  });

  configurarEventos();
  await carregarAgendamentosComFiltros();
  await atualizarHorariosDisponiveis(document.getElementById("dataAgendamento").value);
});

// configurar abas e eventos
function configurarEventos() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-target");
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      contentSections.forEach((section) => {
        section.classList.remove("active");
        if (section.id === target) {
          section.classList.add("active");
          if (target === "controle") atualizarEstatisticas();
          if (target === "relatorios") carregarRelatorioMensal();
        }
      });
    });
  });

  btnAgendar.addEventListener("click", onClickAgendar);
  mesRelatorio.addEventListener("change", carregarRelatorioMensal);
  
  // Evento para atualizar horários quando a data muda
  document.getElementById('dataAgendamento').addEventListener('change', function() {
    atualizarHorariosDisponiveis(this.value);
  });
}

// Função principal para carregar agendamentos com filtros
async function carregarAgendamentosComFiltros() {
  try {
    const params = {};
    
    // Aplicar filtro de status
    if (filtrosAtuais.status === 'pago') {
      params.status = 'pago';
    } else if (filtrosAtuais.status === 'pendente') {
      params.status = 'pendente';
    }
    
    // Aplicar busca
    if (filtrosAtuais.busca.trim() !== '') {
      params.cliente = filtrosAtuais.busca;
    }
    
    agendamentos = await fetchAgendamentosFiltrados(params);
    
    // Atualizar UI
    carregarAgendamentosDoDia();
    carregarTabelaAgendamentos();
    carregarCalendarioSemanal();
    await atualizarEstatisticas();
  } catch (err) {
    console.error('Erro ao carregar agendamentos:', err);
    mostrarErro('Erro ao carregar agendamentos. Verifique se o servidor está rodando.');
  }
}

// adicionar novo (captura do form)
async function onClickAgendar() {
  const nome = document.getElementById("clienteNome").value.trim();
  const telefone = document.getElementById("clienteTelefone").value.trim();
  const servicoSelect = document.getElementById("servico");
  const [servicoTexto, valorStr] = servicoSelect.value.split("|");
  const valor = parseFloat(valorStr);
  const data = document.getElementById("dataAgendamento").value;
  const hora = document.getElementById("horaAgendamento").value;

  if (!nome || !telefone || !data || !hora) {
    alert("Por favor, preencha todos os campos obrigatórios.");
    return;
  }

  const payload = {
    cliente: nome,
    telefone: telefone,
    servico: servicoTexto,
    valor: valor,
    data: data,
    hora: hora,
  };

  try {
    await criarAgendamentoApi(payload);
    // recarregar lista
    await carregarAgendamentosComFiltros();
    // limpar form
    document.getElementById("clienteNome").value = "";
    document.getElementById("clienteTelefone").value = "";
    alert("Agendamento realizado com sucesso!");
    
    // Atualizar horários disponíveis
    await atualizarHorariosDisponiveis(data);
  } catch (err) {
    console.error(err);
    alert("Erro ao salvar agendamento. Veja o console.");
  }
}

// carregar agendamentos do dia
function carregarAgendamentosDoDia() {
  const hoje = new Date().toISOString().split("T")[0];
  const agendamentosHoje = agendamentos.filter((a) => a.data === hoje);

  if (agendamentosHoje.length === 0) {
    listaAgendamentos.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>Nenhum agendamento para hoje</p>
            </div>
        `;
    return;
  }

  agendamentosHoje.sort((a, b) => a.hora.localeCompare(b.hora));

  let html =
    "<table><thead><tr><th>Cliente</th><th>Serviço</th><th>Horário</th><th>Status</th><th>Ações</th></tr></thead><tbody>";

  agendamentosHoje.forEach((agendamento) => {
    html += `
            <tr>
                <td>${escapeHtml(agendamento.cliente)}</td>
                <td>${escapeHtml(agendamento.servico)}</td>
                <td>${agendamento.hora}</td>
                <td><span class="status-badge ${
                  agendamento.pago ? "status-pago" : "status-pendente"
                }">${agendamento.pago ? "Pago" : "Pendente"}</span></td>
                <td class="action-buttons">
                    <button class="action-btn edit" onclick="handleMarcarPago(${
                      agendamento.id
                    })" ${agendamento.pago ? "disabled" : ""}>
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="action-btn delete" onclick="handleCancelar(${
                      agendamento.id
                    })">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `;
  });

  html += "</tbody></table>";
  listaAgendamentos.innerHTML = html;
}

// carregar tabela completa
function carregarTabelaAgendamentos() {
  if (agendamentos.length === 0) {
    tabelaAgendamentos.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-secondary);">
                    Nenhum agendamento registrado
                </td>
            </tr>
        `;
    return;
  }

  const agendamentosOrdenados = [...agendamentos].sort((a, b) => {
    return new Date(b.data + " " + b.hora) - new Date(a.data + " " + a.hora);
  });

  let html = "";

  agendamentosOrdenados.forEach((agendamento) => {
    html += `
            <tr>
                <td>${escapeHtml(agendamento.cliente)}</td>
                <td>${escapeHtml(agendamento.servico)}</td>
                <td>${formatarData(new Date(agendamento.data))} às ${
      agendamento.hora
    }</td>
                <td>R$ ${Number(agendamento.valor).toFixed(2)}</td>
                <td><span class="status-badge ${
                  agendamento.pago ? "status-pago" : "status-pendente"
                }">${agendamento.pago ? "Pago" : "Pendente"}</span></td>
                <td class="action-buttons">
                    <button class="action-btn edit" onclick="handleMarcarPago(${
                      agendamento.id
                    })" ${agendamento.pago ? "disabled" : ""}>
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="action-btn delete" onclick="handleCancelar(${
                      agendamento.id
                    })">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
  });

  tabelaAgendamentos.innerHTML = html;
}

// atualizar estatísticas
async function atualizarEstatisticas() {
  try {
    // Buscar estatísticas do backend
    const [estatHoje, estatSemana, estatMes] = await Promise.all([
      fetchEstatisticas('hoje'),
      fetchEstatisticas('semana'),
      fetchEstatisticas('mes')
    ]);
    
    receitaHoje.textContent = `R$ ${estatHoje.receita.toFixed(2)}`;
    receitaSemana.textContent = `R$ ${estatSemana.receita.toFixed(2)}`;
    receitaMes.textContent = `R$ ${estatMes.receita.toFixed(2)}`;
    totalAgendamentos.textContent = estatMes.total;
  } catch (err) {
    console.error('Erro ao carregar estatísticas:', err);
  }
}

// atualizar horários disponíveis
async function atualizarHorariosDisponiveis(dataSelecionada) {
  try {
    const selectHora = document.getElementById('horaAgendamento');
    const horarios = gerarHorariosValidos();
    
    // Buscar horários ocupados do backend
    const horariosOcupados = await fetchHorariosOcupados(dataSelecionada);
    
    selectHora.innerHTML = '';
    
    const hoje = new Date().toISOString().split('T')[0];
    const ehHoje = dataSelecionada === hoje;
    const agora = new Date();
    const horaAtual = agora.getHours();
    const minutoAtual = agora.getMinutes();
    
    horarios.forEach(hora => {
      const [h, m] = hora.split(':').map(Number);
      const ocupado = horariosOcupados.includes(hora);
      
      const opt = document.createElement('option');
      opt.value = hora;
      opt.textContent = hora;
      
      // Desabilitar horários passados (se for hoje)
      if (ehHoje) {
        if (h < horaAtual || (h === horaAtual && m <= minutoAtual)) {
          opt.disabled = true;
          opt.style.color = '#6b7280';
          opt.textContent += ' (passado)';
        }
      }
      
      // Desabilitar horários ocupados
      if (ocupado) {
        opt.disabled = true;
        opt.style.color = '#ef4444';
        opt.textContent += ' (ocupado)';
      }
      
      selectHora.appendChild(opt);
    });
    
    // Selecionar o primeiro horário disponível
    const primeiroDisponivel = selectHora.querySelector('option:not([disabled])');
    if (primeiroDisponivel) {
      selectHora.value = primeiroDisponivel.value;
    }
  } catch (err) {
    console.error('Erro ao carregar horários:', err);
  }
}

// relatório mensal
function carregarRelatorioMensal() {
  const mesAno = mesRelatorio.value;
  if (!mesAno) return;

  const [ano, mes] = mesAno.split("-").map(Number);
  const agendamentosMes = agendamentos.filter((a) => {
    const dataAgendamento = new Date(a.data);
    return (
      dataAgendamento.getMonth() + 1 === mes &&
      dataAgendamento.getFullYear() === ano &&
      a.pago
    );
  });

  const receita = agendamentosMes.reduce(
    (total, a) => total + Number(a.valor),
    0
  );
  const totalServicosCount = agendamentosMes.length;
  const clientesUnicos = new Set(agendamentosMes.map((a) => a.cliente)).size;
  const ticketMedioValor =
    totalServicosCount > 0 ? receita / totalServicosCount : 0;

  receitaTotal.textContent = `R$ ${receita.toFixed(2)}`;
  totalServicos.textContent = totalServicosCount;
  clientesAtendidos.textContent = clientesUnicos;
  ticketMedio.textContent = `R$ ${ticketMedioValor.toFixed(2)}`;

  const servicosCount = {};
  agendamentosMes.forEach((a) => {
    if (servicosCount[a.servico]) {
      servicosCount[a.servico].count++;
      servicosCount[a.servico].valor += Number(a.valor);
    } else {
      servicosCount[a.servico] = { count: 1, valor: Number(a.valor) };
    }
  });

  if (Object.keys(servicosCount).length === 0) {
    breakdownServicos.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-pie"></i>
                <p>Nenhum dado disponível para o mês selecionado</p>
            </div>
        `;
    return;
  }

  let html = "";
  for (const servico in servicosCount) {
    html += `
            <div class="service-item">
                <div class="service-name">${escapeHtml(servico)}</div>
                <div class="service-stats">
                    <span>${servicosCount[servico].count} serviços</span>
                    <span>R$ ${servicosCount[servico].valor.toFixed(2)}</span>
                </div>
            </div>
        `;
  }

  breakdownServicos.innerHTML = html;
}

// Funções de filtro
function filtrarTabela() {
  const termo = document.getElementById('buscaAgendamentos').value;
  filtrosAtuais.busca = termo;
  carregarAgendamentosComFiltros();
}

function filtrarPorStatus(status) {
  filtrosAtuais.status = status;
  
  // Atualizar botões ativos
  ['todos', 'pendente', 'pago'].forEach(s => {
    const btn = document.getElementById(`btn${s.charAt(0).toUpperCase() + s.slice(1)}`);
    if (btn) btn.classList.remove('active');
  });
  
  const btnAtivo = document.getElementById(`btn${status.charAt(0).toUpperCase() + status.slice(1)}`);
  if (btnAtivo) btnAtivo.classList.add('active');
  
  carregarAgendamentosComFiltros();
}

function filtrarPorData() {
  const data = document.getElementById('filtroData').value;
  if (data) {
    carregarAgendamentosPorData(data);
  } else {
    carregarAgendamentosComFiltros();
  }
}

async function carregarAgendamentosPorData(data) {
  try {
    agendamentos = await fetchAgendamentosFiltrados({ data: data });
    carregarAgendamentosDoDia();
    carregarTabelaAgendamentos();
  } catch (err) {
    console.error('Erro:', err);
  }
}

function filtrarPorServico() {
  const servico = document.getElementById('filtroServico').value;
  if (servico) {
    carregarAgendamentosPorServico(servico);
  } else {
    carregarAgendamentosComFiltros();
  }
}

async function carregarAgendamentosPorServico(servico) {
  try {
    agendamentos = await fetchAgendamentosFiltrados({ servico: servico });
    carregarTabelaAgendamentos();
  } catch (err) {
    console.error('Erro:', err);
  }
}

function limparBusca() {
  document.getElementById('buscaAgendamentos').value = '';
  filtrosAtuais.busca = '';
  carregarAgendamentosComFiltros();
}

// calendário semanal
function carregarCalendarioSemanal() {
  if (!calendarioSemanal) return;
  
  const hoje = new Date();
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - hoje.getDay()); // Domingo
  
  calendarioSemanal.innerHTML = '';
  
  for (let i = 0; i < 7; i++) {
    const dia = new Date(inicioSemana);
    dia.setDate(inicioSemana.getDate() + i);
    const dataStr = dia.toISOString().split('T')[0];
    
    const agendamentosDia = agendamentos.filter(a => a.data === dataStr);
    const hojeStr = hoje.toISOString().split('T')[0];
    
    const div = document.createElement('div');
    div.className = 'dia-calendario' + (dataStr === hojeStr ? ' hoje' : '');
    div.style.cursor = 'pointer';
    div.onclick = () => {
      document.getElementById('dataAgendamento').value = dataStr;
      atualizarHorariosDisponiveis(dataStr);
    };
    
    div.innerHTML = `
      <div class="dia-nome">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dia.getDay()]}</div>
      <div class="dia-numero">${dia.getDate()}</div>
      <div class="dia-contador" style="color: ${agendamentosDia.length > 0 ? 'var(--success)' : 'var(--text-secondary)'}">
        ${agendamentosDia.length} ${agendamentosDia.length === 1 ? 'agendamento' : 'agendamentos'}
      </div>
    `;
    
    calendarioSemanal.appendChild(div);
  }
}

// exportar para CSV
function exportarParaCSV() {
  if (agendamentos.length === 0) {
    alert('Nenhum dado para exportar!');
    return;
  }

  const headers = ['ID', 'Cliente', 'Telefone', 'Serviço', 'Data', 'Hora', 'Valor', 'Status'];
  const csvRows = [
    headers.join(','),
    ...agendamentos.map(a => [
      a.id,
      `"${a.cliente}"`,
      `"${a.telefone}"`,
      `"${a.servico}"`,
      a.data,
      a.hora,
      a.valor,
      a.pago ? 'Pago' : 'Pendente'
    ].join(','))
  ];

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agendamentos-barbertime-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// enviar lembretes
function enviarLembretesDia() {
  const hoje = new Date().toISOString().split('T')[0];
  const agendamentosHoje = agendamentos.filter(a => 
    a.data === hoje && 
    !a.pago && 
    !a.cancelado
  );
  
  if (agendamentosHoje.length === 0) {
    alert('Nenhum agendamento pendente para hoje!');
    return;
  }
  
  if (confirm(`Enviar lembretes para ${agendamentosHoje.length} cliente(s) de hoje?`)) {
    agendamentosHoje.forEach(a => {
      console.log(`Lembrete enviado para: ${a.cliente} (${a.telefone})`);
    });
    alert(`✅ ${agendamentosHoje.length} lembrete(s) simulado(s) enviado(s)!`);
  }
}

// ações (marcar pago / cancelar)
async function handleMarcarPago(id) {
  if (!confirm("Marcar este agendamento como pago?")) return;
  try {
    await marcarPagoApi(id);
    await carregarAgendamentosComFiltros();
  } catch (err) {
    console.error(err);
    alert("Erro ao marcar como pago");
  }
}

async function handleCancelar(id) {
  if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;
  try {
    await deletarAgendamentoApi(id);
    await carregarAgendamentosComFiltros();
  } catch (err) {
    console.error(err);
    alert("Erro ao deletar agendamento");
  }
}

// utilitários
function formatarData(data) {
  if (!(data instanceof Date)) data = new Date(data);
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function escapeHtml(unsafe) {
  if (!unsafe && unsafe !== 0) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function mostrarErro(mensagem) {
  // Criar ou atualizar elemento de erro
  let erroDiv = document.getElementById('erroMensagem');
  if (!erroDiv) {
    erroDiv = document.createElement('div');
    erroDiv.id = 'erroMensagem';
    erroDiv.className = 'error-message';
    document.querySelector('.container').insertBefore(erroDiv, document.querySelector('.content-section'));
  }
  
  erroDiv.innerHTML = `
    <div>
      <i class="fas fa-exclamation-circle"></i> ${mensagem}
    </div>
    <button onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  // Auto-remover após 5 segundos
  setTimeout(() => {
    if (erroDiv.parentElement) {
      erroDiv.remove();
    }
  }, 5000);
}

// expose some functions to the global scope for inline onclick usage
window.handleMarcarPago = handleMarcarPago;
window.handleCancelar = handleCancelar;
window.filtrarTabela = filtrarTabela;
window.filtrarPorStatus = filtrarPorStatus;
window.filtrarPorData = filtrarPorData;
window.filtrarPorServico = filtrarPorServico;
window.limparBusca = limparBusca;
window.exportarParaCSV = exportarParaCSV;
window.enviarLembretesDia = enviarLembretesDia;