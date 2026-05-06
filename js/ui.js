export const Modal = {
  init() {
    if (document.getElementById('modal-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-container">
        <div class="modal-header"><h2 id="modal-title"></h2></div>
        <div class="modal-body" id="modal-content"></div>
        <div class="modal-footer" id="modal-footer"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;
  },

  show({ title, content, actions = [] }) {
    this.init();
    document.getElementById('modal-title').textContent = title;
    const modalContent = document.getElementById('modal-content');
    modalContent.replaceChildren();
    if (typeof content === 'string') {
      const paragraph = document.createElement('p');
      paragraph.textContent = content;
      modalContent.appendChild(paragraph);
    } else {
      modalContent.appendChild(content);
    }

    const footer = document.getElementById('modal-footer');
    footer.innerHTML = '';
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = `modal-btn ${action.type || ''}`;
      btn.textContent = action.label;
      btn.onclick = () => {
        if (action.onClick) action.onClick();
        this.hide();
      };
      footer.appendChild(btn);
    });

    this.overlay.classList.add('active');
  },

  hide() {
    if (this.overlay) this.overlay.classList.remove('active');
  },

  confirm(title, message, onConfirm) {
    this.show({
      title,
      content: message,
      actions: [
        { label: '取消', type: '' },
        { label: '确定', type: 'danger', onClick: onConfirm }
      ]
    });
  },

  prompt(title, message, placeholder, onConfirm, options = {}) {
    const input = document.createElement('input');
    input.type = options.inputType || 'text';
    input.className = 'modal-input';
    input.placeholder = placeholder;
    input.autocomplete = options.autocomplete || 'off';
    const container = document.createElement('form');
    container.addEventListener('submit', (event) => {
      event.preventDefault();
      onConfirm(input.value);
      this.hide();
    });
    const paragraph = document.createElement('p');
    paragraph.textContent = message;
    container.appendChild(paragraph);
    if (input.type === 'password') {
      const username = document.createElement('input');
      username.type = 'text';
      username.autocomplete = 'username';
      username.value = 'pictures-lib-admin';
      username.hidden = true;
      username.tabIndex = -1;
      container.appendChild(username);
    }
    container.appendChild(input);

    this.show({
      title,
      content: container,
      actions: [
        { label: '取消', type: '', onClick: () => (options.onCancel ? options.onCancel() : onConfirm('')) },
        { label: '提交', type: 'primary', onClick: () => onConfirm(input.value) }
      ]
    });
    setTimeout(() => input.focus(), 100);
  }
};

export const Toast = {
  show(message, duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};
