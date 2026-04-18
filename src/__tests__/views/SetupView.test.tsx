import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SetupView from '@/views/SetupView';

// Mocking do i18n
vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const texts: Record<string, string> = {
        'setup.create.title': 'Create Game',
        'setup.join.title': 'Join Game',
        'setup.name': 'Your Name',
        'setup.name.placeholder': 'Enter name',
        'setup.room_name': 'Room Name',
        'setup.room_name.placeholder': 'Enter Room',
        'setup.code': 'Room Code',
        'setup.create.button': 'Start',
        'setup.join.button': 'Enter',
        'setup.back': 'Back',
      };
      return texts[key] || key;
    }
  })
}));

describe('SetupView', () => {
  const defaultProps = {
    playerName: '',
    onNameChange: vi.fn(),
    onInit: vi.fn(),
    onJoin: vi.fn(),
    onBack: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modo: CRIAR SALA (CREATE)', () => {
    it('renderiza o layout de criar sala corretamente', () => {
      render(<SetupView {...defaultProps} mode="CREATE" />);

      expect(screen.getByText('Create Game')).toBeInTheDocument();
      expect(screen.getByText('Your Name')).toBeInTheDocument();
      expect(screen.getByText('Room Name')).toBeInTheDocument();
      // Não deve ter o campo de Código da Sala
      expect(screen.queryByText('Room Code')).not.toBeInTheDocument();
    });

    it('chama onNameChange ao digitar no input de Nome do Jogador', async () => {
      const user = userEvent.setup();
      render(<SetupView {...defaultProps} mode="CREATE" />);

      const nameInput = screen.getByPlaceholderText('Enter name');
      await user.type(nameInput, 'Alex');

      // O input chama `onNameChange` para cada letra ou validação
      expect(defaultProps.onNameChange).toHaveBeenCalled();
    });

    it('chama onInit passando roomName quando clica no botão principal', async () => {
      const user = userEvent.setup();
      render(<SetupView {...defaultProps} mode="CREATE" />);

      const roomInput = screen.getByPlaceholderText('Enter Room');
      await user.type(roomInput, 'Minha Sala');

      const createBtn = screen.getByText('Start');
      await user.click(createBtn);

      // Deve ter iniciado a sala usando o nome digitado!
      expect(defaultProps.onInit).toHaveBeenCalledWith('Minha Sala');
      expect(defaultProps.onJoin).not.toHaveBeenCalled();
    });
  });

  describe('Modo: ENTRAR NA SALA (JOIN)', () => {
    it('renderiza o layout de entrar na sala corretamente', () => {
      render(<SetupView {...defaultProps} mode="JOIN" />);

      expect(screen.getByText('Join Game')).toBeInTheDocument();
      expect(screen.getByText('Your Name')).toBeInTheDocument();
      expect(screen.getByText('Room Code')).toBeInTheDocument();
      // Não deve ter o campo de Nome da Sala
      expect(screen.queryByText('Room Name')).not.toBeInTheDocument();
    });

    it('chama onJoin passando roomCode ao clicar no botão principal', async () => {
      const user = userEvent.setup();
      render(<SetupView {...defaultProps} mode="JOIN" />);

      const codeInput = screen.getByPlaceholderText('XXXXXX');
      await user.type(codeInput, 'XZ99');

      const joinBtn = screen.getByText('Enter');
      await user.click(joinBtn);

      // Deve disparar a entrada na sala com o código digitado
      expect(defaultProps.onJoin).toHaveBeenCalledWith('XZ99');
      expect(defaultProps.onInit).not.toHaveBeenCalled();
    });
  });

  describe('Navegação Fixa', () => {
    it('chama onBack quando clica no botão Voltar', async () => {
      const user = userEvent.setup();
      render(<SetupView {...defaultProps} mode="CREATE" />);

      const backBtn = screen.getByText('Back');
      await user.click(backBtn);

      expect(defaultProps.onBack).toHaveBeenCalledOnce();
    });
  });

  describe('Cenários Negativos (Filtros de Erros e Limites)', () => {
    // Aqui testamos se as proteções estão ativas. Se o teste passar e o React permitir
    // caracteres inválidos, quer dizer que tem algo "frouxo" no componente!

    it('NÃO deve permitir que a mudança de nome envie caracteres especiais', () => {
      render(<SetupView {...defaultProps} mode="CREATE" />);

      const nameInput = screen.getByPlaceholderText('Enter name');

      // Enviamos a string completa de uma vez simulando um "Colar" ou mudança bruta
      // já que a variável "playerName" do teste é fixada em ''
      fireEvent.change(nameInput, { target: { value: 'P@lay er 1!' } });

      // Graças a proteção (sanitized), o React NÃO pode ter enviado "P@lay er 1!"
      expect(defaultProps.onNameChange).not.toHaveBeenCalledWith(expect.stringContaining('@'));
      expect(defaultProps.onNameChange).not.toHaveBeenCalledWith(expect.stringContaining(' '));

      // O que deve ter passado é apenas "Player1"
      expect(defaultProps.onNameChange).toHaveBeenCalledWith('Player1');
    });

    it('NÃO deve enviar código da sala em letras minúsculas (Força UpperCase)', async () => {
      const user = userEvent.setup();

      // Simulando a renderização na parte de JOIN
      render(<SetupView {...defaultProps} mode="JOIN" />);
      const codeInput = screen.getByPlaceholderText('XXXXXX');

      // Digitando letras minúsculas
      await user.type(codeInput, 'ab12');

      const joinBtn = screen.getByText('Enter');
      await user.click(joinBtn);

      // Se a função onJoin for chamada com "ab12" (minúscula), tem algo errado!
      expect(defaultProps.onJoin).not.toHaveBeenCalledWith('ab12');

      // Ela DEVE obrigatoriamente estar forçando pra AB12!
      expect(defaultProps.onJoin).toHaveBeenCalledWith('AB12');
    });

    it('NÃO deve aceitar nome de jogador maior que 10 caracteres', () => {
      render(<SetupView {...defaultProps} mode="CREATE" />);
      const nameInput = screen.getByPlaceholderText('Enter name');

      // Enviamos uma string de 15 caracteres
      fireEvent.change(nameInput, { target: { value: '1234567890ABCDE' } });

      // O limite é duro na lógica do React, deve passar apenas os 10 primeiros
      expect(defaultProps.onNameChange).toHaveBeenCalledWith('1234567890');
      // Garantir que a fraude inteira não passou
      expect(defaultProps.onNameChange).not.toHaveBeenCalledWith('1234567890ABCDE');
    });

    it('NÃO deve aceitar nome da sala maior que 30 caracteres', async () => {
      const user = userEvent.setup();
      render(<SetupView {...defaultProps} mode="CREATE" />);

      const roomInput = screen.getByPlaceholderText('Enter Room');
      const createBtn = screen.getByText('Start');

      // String gerada de 35 caracteres exatos: 
      const superLongRoomName = 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R';
      // Os primeiros 30 caracteres formam: 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5'
      const truncatedRoomName = superLongRoomName.slice(0, 30);

      // Ao invés de digitar uma a uma (porque tem limitadores de delay), fazemos a colagem pesada
      fireEvent.change(roomInput, { target: { value: superLongRoomName } });

      await user.click(createBtn);

      // Deve iniciar a sala OBRIGATORIAMENTE cortada nos 30 caracteres perfeitos
      expect(defaultProps.onInit).toHaveBeenCalledWith(truncatedRoomName);
    });
  });
});
