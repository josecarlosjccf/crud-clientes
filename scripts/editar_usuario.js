class EditarUsuario {
    constructor() {
        this.form = document.getElementById('formCadastro');
        this.init();
    }

    async init() {
        try {
            // Busca o usuário mais recente do servidor
            const usuario = await this.buscarUsuarioMaisRecente();
            
            if (!usuario) {
                alert('Nenhum usuário encontrado. Faça login novamente.');
                window.location.href = '/';
                return;
            }

            this.usuarioAtual = usuario;
            
            // Preenche o formulário com os dados do usuário
            this.preencherFormulario();
            
            // Adiciona evento de submit
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
            
        } catch (error) {
            console.error('Erro ao carregar usuário:', error);
            alert('Erro ao carregar dados do usuário.');
            window.location.href = '/';
        }
    }

    async buscarUsuarioMaisRecente() {
        try {
            const response = await fetch('/api/usuario-atual');
            
            if (!response.ok) {
                throw new Error('Erro ao buscar usuário');
            }
            
            const result = await response.json();
            return result.usuario;
            
        } catch (error) {
            console.error('Erro ao buscar usuário mais recente:', error);
            return null;
        }
    }

    preencherFormulario() {
        document.getElementById('nome').value = this.usuarioAtual.nome || '';
        document.getElementById('email').value = this.usuarioAtual.email || '';
        // Não preenche a senha por segurança, deixa vazia
        document.getElementById('senha').value = '';
        
        // Muda o texto do botão
        const submitButton = this.form.querySelector('button[type="submit"]');
        submitButton.textContent = 'Atualizar';
    }

    async handleSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(this.form);
        const dadosAtualizados = {
            id: this.usuarioAtual.id,
            nome: formData.get('nome') || this.usuarioAtual.nome,
            email: formData.get('email') || this.usuarioAtual.email,
            senha: formData.get('senha') || this.usuarioAtual.senha // Mantém a senha atual se não for informada nova
        };

        try {
            const response = await fetch('/api/editar', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dadosAtualizados)
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage('Usuário atualizado com sucesso!', 'success');
                
                // Redireciona após 2 segundos
                setTimeout(() => {
                    window.location.href = '/lista';
                }, 2000);
            } else {
                this.showMessage(result.erro || 'Erro ao atualizar usuário', 'danger');
            }
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            this.showMessage('Erro de conexão. Tente novamente.', 'danger');
        }
    }

    showMessage(message, type) {
        // Remove mensagem anterior se existir
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        // Cria nova mensagem
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show mt-3`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Adiciona após o formulário
        this.form.parentNode.appendChild(alertDiv);
    }
}

// Inicializa quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
    new EditarUsuario();
});