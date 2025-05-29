class LoginUser {
  constructor() {
    this.form = document.getElementById('form-login');
    this.emailInput = document.getElementById('email');
    this.senhaInput = document.getElementById('senha');
    this.mensagemErro = document.getElementById('mensagem-erro');
    this.init();
  }

  init() {
    this.form.addEventListener('submit', e => {
      e.preventDefault();
      this.login();
    });
  }

  async login() {
    const email = this.emailInput.value.trim();
    const password = this.senhaInput.value;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        this.mensagemErro.textContent = data.error || 'Erro desconhecido';
        return;
      }

      // Redireciona para lista_clientes.html (arquivo na raiz)
      window.location.href = '/lista_clientes.html';

    } catch (error) {
      this.mensagemErro.textContent = 'Erro ao conectar ao servidor.';
      console.error(error);
    }
  }
}

new LoginUser();