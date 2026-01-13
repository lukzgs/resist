import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'pt' | 'en';

const LANGUAGE_KEY = 'resist_language';

// Traduções
const translations = {
    pt: {
        // Home
        'home.title': 'SKYNET',
        'home.subtitle': 'Protocolo de Infiltração',
        'home.create': 'CRIAR SALA',
        'home.create.desc': 'Inicie uma nova partida',
        'home.join': 'ENTRAR NA SALA',
        'home.join.desc': 'Conecte-se com o código',
        'home.browse': 'PROCURAR SALAS',
        'home.browse.desc': 'Jogue com desconhecidos',
        'home.status': 'PRONTO PARA CONEXÃO',

        // Setup
        'setup.create.title': 'Criar Sala',
        'setup.join.title': 'Entrar na Sala',
        'setup.name': 'Seu Nome',
        'setup.name.placeholder': 'Ex: João',
        'setup.code': 'Código da Sala',
        'setup.code.via_link': '(via link)',
        'setup.room_name': 'Nome da Sala',
        'setup.room_name.placeholder': 'Ex: Partida do João',
        'setup.room_name.hint': 'Deixe vazio para gerar automaticamente',
        'setup.create.button': 'Criar',
        'setup.join.button': 'Conectar',
        'setup.back': 'Voltar',

        // Lobby
        'lobby.code': 'Código da Sala',
        'lobby.copy': 'Copiar Link',
        'lobby.copied': 'Link Copiado!',
        'lobby.leave': 'Sair da Sala',
        'lobby.players': 'Jogadores',
        'lobby.connected': 'CONECTADOS',
        'lobby.terminators': 'TERMINATORS',
        'lobby.units': 'UNIDADES',
        'lobby.bunker': 'STATUS DO BUNKER',
        'lobby.stable': 'ESTÁVEL',
        'lobby.settings': 'Configurações',
        'lobby.show_votes': 'Mostrar Votos',
        'lobby.show_rejections': 'Mostrar Rejeições',
        'lobby.start': 'INICIAR PARTIDA',
        'lobby.waiting': 'AGUARDANDO JOGADORES',
        'lobby.min_players': 'Mínimo 5 jogadores',
        'lobby.host': 'HOST',
        'lobby.online': 'ONLINE',
        'lobby.offline': 'OFFLINE',
        'lobby.public_room': 'SALA PÚBLICA',
        'lobby.public_room.desc': 'Visível na busca de salas',

        // Game
        'game.mission': 'Missão',
        'game.round': 'Rodada',
        'game.leader': 'Líder',
        'game.team': 'Equipe',
        'game.vote': 'Votar',
        'game.approve': 'Aprovar',
        'game.reject': 'Rejeitar',
        'game.success': 'Sucesso',
        'game.fail': 'Sabotar',
        'game.waiting_vote': 'Aguardando votos dos outros agentes...',
        'game.waiting_mission': 'Sincronizando dados táticos...',
        'game.select_team': 'Aguardando Seleção de Alvos',
        'game.submit_team': 'Confirmar Esquadrão',
        'game.your_role': 'Seu Papel',
        'game.human': 'HUMANO',
        'game.terminator': 'TERMINATOR',
        'game.human.desc': 'Complete as missões com sucesso',
        'game.terminator.desc': 'Sabote as missões secretamente',
        'game.approved': 'Aprovado',
        'game.rejected': 'Rejeitado',
        'game.failed': 'FALHOU',
        'game.succeeded': 'SUCESSO',
        'game.resistance_wins': 'Resistance_Won',
        'game.skynet_wins': 'Skynet_Prevails',
        'game.play_again': 'Nova Partida',
        'game.back_menu': 'Sair',
        'game.log': 'Log de Eventos',
        'game.rejections': 'Rejeições',
        'game.room': 'Sala',
        'game.terminators_count': 'Terminators',
        'game.validate_team': 'Validar Equipe?',
        'game.last_vote': 'Última votação',
        'game.agent_pending': 'agente pendente',
        'game.agents_pending': 'agentes pendentes',
        'game.commander_selecting': 'Comandante selecionando unidades...',
        'game.field_operation': 'Operação em Campo Ativa',
        'game.identities_revealed': 'Identidades Reveladas',
        'game.room_closes_in': 'Sala fecha em',
        'game.win_human_desc': 'O Dia do Julgamento foi evitado. A linha temporal foi preservada.',
        'game.win_skynet_desc': 'A Resistência foi destruída. As máquinas controlam o futuro.',
        'game.error_player': 'Erro: jogador não encontrado. Recarregue a página.',

        // Reconnect
        'reconnect.title': 'Sessão Detectada',
        'reconnect.desc': 'Uma sessão anterior foi encontrada',
        'reconnect.room': 'Sala',
        'reconnect.player': 'Jogador',
        'reconnect.button': 'Reconectar',
        'reconnect.back': 'Voltar ao Menu',
        'reconnect.connecting': 'Conectando...',
        'reconnect.failed': 'Conexão Falhou',

        // Browse Rooms
        'browse.title': 'SALAS PÚBLICAS',
        'browse.subtitle': 'Encontre uma partida para entrar',
        'browse.loading': 'Buscando salas...',
        'browse.empty': 'Nenhuma sala disponível',
        'browse.empty.hint': 'Crie uma sala ou tente novamente',
        'browse.updated': 'Atualizado há',
        'common.back': 'VOLTAR',

        // Common
        'common.spectator': 'ESPECTADOR',
        'common.you': 'VOCÊ',
    },
    en: {
        // Home
        'home.title': 'SKYNET',
        'home.subtitle': 'Infiltration Protocol',
        'home.create': 'CREATE ROOM',
        'home.create.desc': 'Start a new game',
        'home.join': 'JOIN ROOM',
        'home.join.desc': 'Connect with room code',
        'home.browse': 'BROWSE ROOMS',
        'home.browse.desc': 'Play with strangers',
        'home.status': 'READY FOR CONNECTION',

        // Setup
        'setup.create.title': 'Create Room',
        'setup.join.title': 'Join Room',
        'setup.name': 'Your Name',
        'setup.name.placeholder': 'Ex: John',
        'setup.code': 'Room Code',
        'setup.code.via_link': '(via link)',
        'setup.room_name': 'Room Name',
        'setup.room_name.placeholder': "Ex: John's Game",
        'setup.room_name.hint': 'Leave empty to generate automatically',
        'setup.create.button': 'Create',
        'setup.join.button': 'Connect',
        'setup.back': 'Back',

        // Lobby
        'lobby.code': 'Room Code',
        'lobby.copy': 'Copy Link',
        'lobby.copied': 'Link Copied!',
        'lobby.leave': 'Leave Room',
        'lobby.players': 'Players',
        'lobby.connected': 'CONNECTED',
        'lobby.terminators': 'TERMINATORS',
        'lobby.units': 'UNITS',
        'lobby.bunker': 'BUNKER STATUS',
        'lobby.stable': 'STABLE',
        'lobby.settings': 'Settings',
        'lobby.show_votes': 'Show Votes',
        'lobby.show_rejections': 'Show Rejections',
        'lobby.start': 'START GAME',
        'lobby.waiting': 'WAITING FOR PLAYERS',
        'lobby.min_players': 'Minimum 5 players',
        'lobby.host': 'HOST',
        'lobby.online': 'ONLINE',
        'lobby.offline': 'OFFLINE',
        'lobby.public_room': 'PUBLIC ROOM',
        'lobby.public_room.desc': 'Visible in room search',

        // Game
        'game.mission': 'Mission',
        'game.round': 'Round',
        'game.leader': 'Leader',
        'game.team': 'Team',
        'game.vote': 'Vote',
        'game.approve': 'Approve',
        'game.reject': 'Reject',
        'game.success': 'Success',
        'game.fail': 'Sabotage',
        'game.waiting_vote': 'Waiting for other agents\' votes...',
        'game.waiting_mission': 'Syncing tactical data...',
        'game.select_team': 'Awaiting Target Selection',
        'game.submit_team': 'Confirm Squad',
        'game.your_role': 'Your Role',
        'game.human': 'HUMAN',
        'game.terminator': 'TERMINATOR',
        'game.human.desc': 'Complete missions successfully',
        'game.terminator.desc': 'Sabotage missions secretly',
        'game.approved': 'Approved',
        'game.rejected': 'Rejected',
        'game.failed': 'FAILED',
        'game.succeeded': 'SUCCESS',
        'game.resistance_wins': 'Resistance_Won',
        'game.skynet_wins': 'Skynet_Prevails',
        'game.play_again': 'New Game',
        'game.back_menu': 'Exit',
        'game.log': 'Event Log',
        'game.rejections': 'Rejections',
        'game.room': 'Room',
        'game.terminators_count': 'Terminators',
        'game.validate_team': 'Validate Team?',
        'game.last_vote': 'Last vote',
        'game.agent_pending': 'agent pending',
        'game.agents_pending': 'agents pending',
        'game.commander_selecting': 'Commander selecting units...',
        'game.field_operation': 'Field Operation Active',
        'game.identities_revealed': 'Identities Revealed',
        'game.room_closes_in': 'Room closes in',
        'game.win_human_desc': 'Judgment Day was averted. The timeline was preserved.',
        'game.win_skynet_desc': 'The Resistance was destroyed. The machines control the future.',
        'game.error_player': 'Error: player not found. Reload the page.',

        // Reconnect
        'reconnect.title': 'Session Detected',
        'reconnect.desc': 'A previous session was found',
        'reconnect.room': 'Room',
        'reconnect.player': 'Player',
        'reconnect.button': 'Reconnect',
        'reconnect.back': 'Back to Menu',
        'reconnect.connecting': 'Connecting...',
        'reconnect.failed': 'Connection Failed',

        // Browse Rooms
        'browse.title': 'PUBLIC ROOMS',
        'browse.subtitle': 'Find a match to join',
        'browse.loading': 'Searching rooms...',
        'browse.empty': 'No rooms available',
        'browse.empty.hint': 'Create a room or try again',
        'browse.updated': 'Updated',
        'common.back': 'BACK',

        // Common
        'common.spectator': 'SPECTATOR',
        'common.you': 'YOU',
    },
} as const;

type TranslationKey = keyof typeof translations.pt;

interface I18nContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>(() => {
        const stored = localStorage.getItem(LANGUAGE_KEY);
        if (stored === 'pt' || stored === 'en') return stored;
        // Detecta idioma do navegador
        const browserLang = navigator.language.toLowerCase();
        return browserLang.startsWith('pt') ? 'pt' : 'en';
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem(LANGUAGE_KEY, lang);
    };

    const t = (key: TranslationKey): string => {
        return translations[language][key] || key;
    };

    return (
        <I18nContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useTranslation must be used within I18nProvider');
    }
    return context;
}
