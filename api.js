const API_BASE = "http://localhost:5000";

async function fetchAgendamentos() {
  const res = await fetch(`${API_BASE}/agendamentos`);
  if (!res.ok) throw new Error("Erro ao buscar agendamentos");
  return res.json();
}

async function fetchAgendamentosFiltrados(filtros = {}) {
  const params = new URLSearchParams();
  
  if (filtros.cliente) params.append('cliente', filtros.cliente);
  if (filtros.servico) params.append('servico', filtros.servico);
  if (filtros.telefone) params.append('telefone', filtros.telefone);
  if (filtros.data) params.append('data', filtros.data);
  if (filtros.pago !== undefined) params.append('pago', filtros.pago);
  if (filtros.status) params.append('status', filtros.status);
  
  const queryString = params.toString();
  const url = queryString ? 
    `${API_BASE}/agendamentos?${queryString}` : 
    `${API_BASE}/agendamentos`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erro ao buscar agendamentos");
  return res.json();
}

async function fetchHorariosOcupados(data) {
  const res = await fetch(`${API_BASE}/agendamentos/ocupados?data=${data}`);
  if (!res.ok) throw new Error("Erro ao buscar horários ocupados");
  return res.json();
}

async function fetchEstatisticas(periodo) {
  const res = await fetch(`${API_BASE}/agendamentos/estatisticas?periodo=${periodo}`);
  if (!res.ok) throw new Error("Erro ao buscar estatísticas");
  return res.json();
}

async function criarAgendamentoApi(payload) {
  const res = await fetch(`${API_BASE}/agendamentos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Erro ao criar agendamento");
  return res.json();
}

async function marcarPagoApi(id) {
  const res = await fetch(`${API_BASE}/agendamentos/${id}/pago`, {
    method: "PUT",
  });
  if (!res.ok) throw new Error("Erro ao marcar como pago");
  return res.json();
}

async function deletarAgendamentoApi(id) {
  const res = await fetch(`${API_BASE}/agendamentos/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Erro ao deletar agendamento");
  return res.json();
}