from flask import Flask, request, jsonify
from flask_cors import CORS
from db import get_connection
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)


# --------------------------------------------------------------------
# LISTAR AGENDAMENTOS COM FILTROS
# --------------------------------------------------------------------
@app.get("/agendamentos")
def listar_agendamentos():
    conn = get_connection()
    cur = conn.cursor()

    # Obter parâmetros de filtro da query string
    cliente = request.args.get('cliente')
    servico = request.args.get('servico')
    telefone = request.args.get('telefone')
    data = request.args.get('data')
    pago = request.args.get('pago')
    status = request.args.get('status')  # 'todos', 'pago', 'pendente'

    # Construir query dinâmica
    query = "SELECT * FROM agendamentos WHERE 1=1"
    params = []

    if cliente:
        query += " AND cliente ILIKE %s"
        params.append(f"%{cliente}%")

    if servico:
        query += " AND servico ILIKE %s"
        params.append(f"%{servico}%")

    if telefone:
        query += " AND telefone ILIKE %s"
        params.append(f"%{telefone}%")

    if data:
        query += " AND data = %s"
        params.append(data)

    if pago:
        query += " AND pago = %s"
        params.append(pago.lower() == 'true')

    if status:
        if status == 'pago':
            query += " AND pago = TRUE"
        elif status == 'pendente':
            query += " AND pago = FALSE"

    query += " ORDER BY data, hora;"

    cur.execute(query, params)
    rows = cur.fetchall()

    agendamentos = []
    for row in rows:
        agendamentos.append({
            "id": row[0],
            "cliente": row[1],
            "telefone": row[2],
            "servico": row[3],
            "valor": float(row[4]),
            "data": row[5].isoformat(),
            "hora": row[6].strftime("%H:%M"),
            "pago": row[7]
        })

    cur.close()
    conn.close()
    return jsonify(agendamentos)


# --------------------------------------------------------------------
# VERIFICAR HORÁRIO OCUPADO
# --------------------------------------------------------------------
@app.get("/agendamentos/ocupados")
def horarios_ocupados():
    data = request.args.get('data')
    if not data:
        return jsonify({"error": "Data é obrigatória"}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT hora 
        FROM agendamentos 
        WHERE data = %s 
        ORDER BY hora;
    """, (data,))

    rows = cur.fetchall()
    horarios = [row[0].strftime("%H:%M") for row in rows]

    cur.close()
    conn.close()
    return jsonify(horarios)


# --------------------------------------------------------------------
# ESTATÍSTICAS
# --------------------------------------------------------------------
@app.get("/agendamentos/estatisticas")
def obter_estatisticas():
    periodo = request.args.get('periodo', 'hoje')  # hoje, semana, mes

    conn = get_connection()
    cur = conn.cursor()

    hoje = datetime.now().date()

    if periodo == 'hoje':
        query = """
            SELECT 
                COUNT(*) as total,
                COALESCE(SUM(CASE WHEN pago THEN valor ELSE 0 END), 0) as receita
            FROM agendamentos 
            WHERE data = %s
        """
        params = (hoje,)
    elif periodo == 'semana':
        inicio_semana = hoje - timedelta(days=hoje.weekday())
        query = """
            SELECT 
                COUNT(*) as total,
                COALESCE(SUM(CASE WHEN pago THEN valor ELSE 0 END), 0) as receita
            FROM agendamentos 
            WHERE data >= %s
        """
        params = (inicio_semana,)
    else:  # mes
        query = """
            SELECT 
                COUNT(*) as total,
                COALESCE(SUM(CASE WHEN pago THEN valor ELSE 0 END), 0) as receita
            FROM agendamentos 
            WHERE EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)
                AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)
        """
        params = ()

    cur.execute(query, params)
    result = cur.fetchone()

    cur.close()
    conn.close()

    return jsonify({
        "total": result[0],
        "receita": float(result[1]) if result[1] else 0
    })


# --------------------------------------------------------------------
# CRIAR agendamento
# --------------------------------------------------------------------
@app.post("/agendamentos")
def criar_agendamento():
    data = request.json

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO agendamentos (cliente, telefone, servico, valor, data, hora, pago)
        VALUES (%s, %s, %s, %s, %s, %s, FALSE)
        RETURNING id;
    """, (
        data["cliente"],
        data["telefone"],
        data["servico"],
        data["valor"],
        data["data"],
        data["hora"]
    ))

    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"status": "ok", "id": new_id})


# --------------------------------------------------------------------
# MARCAR COMO PAGO
# --------------------------------------------------------------------
@app.put("/agendamentos/<int:id>/pago")
def marcar_pago(id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("UPDATE agendamentos SET pago = TRUE WHERE id = %s;", (id,))
    conn.commit()

    cur.close()
    conn.close()
    return jsonify({"status": "ok"})


# --------------------------------------------------------------------
# DELETAR agendamento
# --------------------------------------------------------------------
@app.delete("/agendamentos/<int:id>")
def deletar(id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("DELETE FROM agendamentos WHERE id = %s;", (id,))
    conn.commit()

    cur.close()
    conn.close()
    return jsonify({"status": "ok"})


# --------------------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True)