// Classe responsável pelo cadastro do usuário no frontend
class CadastroUser {
  /**
   * @param {string} formId - ID do formulário HTML para capturar dados e eventos
   */
  constructor(formId) {
    this.form = document.getElementById(formId);
    if (!this.form) throw new Error('Formulário não encontrado');

    // Endpoint para enviar os dados do cadastro
    this.apiUrl = '/api/cadastro/usuarios';

    // IDs dos campos que serão capturados no formulário
    this.campos = ['nome', 'email', 'senha'];

    // Vincula o evento de submit do formulário ao método enviarCadastro
    this.form.addEventListener('submit', this.enviarCadastro.bind(this));
  }

  /**
   * Captura os valores dos campos do formulário
   * @returns {Object} - Objeto com os dados dos campos
   */
  pegarDados() {
    return this.campos.reduce((obj, id) => {
      const el = document.getElementById(id);
      obj[id] = el ? el.value.trim() : '';
      return obj;
    }, {});
  }

  /**
   * Valida se todos os campos estão preenchidos
   * @param {Object} dados - Dados a validar
   * @returns {boolean} - true se todos preenchidos, false caso contrário
   */
  validar(dados) {
    return this.campos.every(campo => dados[campo]);
  }

  /**
   * Exibe um alerta simples com a mensagem
   * @param {string} msg - Mensagem para mostrar
   * @param {string} tipo - Tipo da mensagem ('info', 'error', 'success')
   * @param {function} [callback] - Função a executar após o alerta
   */
  mostrarAlerta(msg, tipo = 'info', callback) {
    alert(msg);
    if (callback) callback();
  }

  /**
   * Método que envia os dados para o backend via fetch (POST)
   * @param {Event} event - Evento do submit do formulário
   */
  async enviarCadastro(event) {
    event.preventDefault(); // Evita reload da página

    const dados = this.pegarDados();

    // Validação simples antes de enviar
    if (!this.validar(dados)) {
      return this.mostrarAlerta('Preencha todos os campos!', 'error');
    }

    try {
      // Envia os dados para o backend
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });

      const json = await res.json();

      if (res.ok) {
        // Sucesso: mostra alerta e redireciona para index.html
        this.mostrarAlerta(json.mensagem || 'Usuário cadastrado com sucesso!', 'success', () => {
          window.location.href = 'index.html';
        });
      } else {
        // Erro de validação ou conflito
        this.mostrarAlerta(json.erro || 'Erro ao cadastrar usuário', 'error');
      }
    } catch (error) {
      // Erro de conexão com o servidor
      this.mostrarAlerta('Erro de conexão com o servidor', 'error');
    }
  }
}

// Inicializa a classe quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
  try {
    new CadastroUser('formCadastro');
  } catch (err) {
    console.error(err.message);
  }
});