import {
  CalendarDays,
  Gamepad2,
  HardDrive,
  Home,
  Keyboard,
  MessageCircle,
  Monitor,
  Music2,
  Settings,
  ShieldCheck,
  Trophy,
  Volume2,
  Wrench,
  Zap,
} from 'lucide-vue-next'

export const storageKey = 'shenpulse-wheel-overlay-v2'

export const defaultSegments = [
  { label: '10 pompes', color: '#ff6a00', action: 'select' },
  { label: 'Choisis un défi', color: '#111111', action: 'select' },
  { label: 'x2 pendant 1 min', color: '#f59f00', action: 'select' },
  { label: 'Question chat', color: '#2a1207', action: 'select' },
  { label: 'Danse 15 sec', color: '#ff8a1f', action: 'select' },
  { label: 'Rien du tout', color: '#1e1e1e', action: 'select' },
  { label: 'Action mystère', color: '#ffb04a', action: 'select' },
  { label: 'Re-spin', color: '#371707', action: 'select' },
]

export const premiumSegments = [
  { label: '15s push-ups', color: '#7b1fa2', action: 'select' },
  { label: '4x planks', color: '#f59f00', action: 'select' },
  { label: 'Nothing', color: '#2f8f00', action: 'select' },
  { label: '3x sit-ups', color: '#0067b8', action: 'select' },
  { label: '10x push-ups', color: '#c51f12', action: 'select' },
  { label: '1x spin', color: '#9b168d', action: 'select' },
  { label: '20x sit-ups', color: '#008d8f', action: 'select' },
  { label: '5x planks', color: '#d77a00', action: 'select' },
  { label: '15s push-ups', color: '#005fae', action: 'select' },
  { label: '1x sit-ups', color: '#2e8b00', action: 'select' },
  { label: '20x push-ups', color: '#d52a16', action: 'select' },
  { label: '5x sit-ups', color: '#0094a3', action: 'select' },
]

export const giftTriggers = [
  { id: 'none', name: 'Sélectionner un cadeau...', cost: '', colors: ['#3a332f', '#191512'] },
]

export const actionOptions = [
  { id: 'select', labelKey: 'action.select' },
  { id: 'sound', labelKey: 'action.sound' },
  { id: 'alert', labelKey: 'action.alert' },
  { id: 'points', labelKey: 'action.points' },
  { id: 'command', labelKey: 'action.command' },
]

export const fontOptions = ['Kalam', 'Inter', 'Impact', 'Arial Rounded', 'System']

export const textOrientationOptions = [
  { id: 'horizontal', labelKey: 'settings.textOrientationHorizontal' },
  { id: 'vertical', labelKey: 'settings.textOrientationVertical' },
]

export const textAlignOptions = [
  { id: 'left', labelKey: 'settings.textAlignLeft' },
  { id: 'center', labelKey: 'settings.textAlignCenter' },
  { id: 'right', labelKey: 'settings.textAlignRight' },
]

export const wheelDesignOptions = [
  { id: 'classic', labelKey: 'settings.designClassic' },
  { id: 'royal', labelKey: 'settings.designRoyal' },
]

export const entranceAnimationOptions = [
  { id: 'fade', labelKey: 'settings.entranceFade' },
  { id: 'slide-left', labelKey: 'settings.entranceSlideLeft' },
  { id: 'slide-right', labelKey: 'settings.entranceSlideRight' },
  { id: 'slide-top', labelKey: 'settings.entranceSlideTop' },
  { id: 'slide-bottom', labelKey: 'settings.entranceSlideBottom' },
  { id: 'zoom', labelKey: 'settings.entranceZoom' },
  { id: 'pop', labelKey: 'settings.entrancePop' },
  { id: 'flip', labelKey: 'settings.entranceFlip' },
  { id: 'roll-left', labelKey: 'settings.entranceRollLeft' },
  { id: 'roll-right', labelKey: 'settings.entranceRollRight' },
]

export const exitAnimationOptions = [
  { id: 'fade', labelKey: 'settings.exitFade' },
  { id: 'slide-left', labelKey: 'settings.exitSlideLeft' },
  { id: 'slide-right', labelKey: 'settings.exitSlideRight' },
  { id: 'slide-top', labelKey: 'settings.exitSlideTop' },
  { id: 'slide-bottom', labelKey: 'settings.exitSlideBottom' },
  { id: 'zoom', labelKey: 'settings.exitZoom' },
  { id: 'pop', labelKey: 'settings.exitPop' },
  { id: 'flip', labelKey: 'settings.exitFlip' },
  { id: 'roll-left', labelKey: 'settings.exitRollLeft' },
  { id: 'roll-right', labelKey: 'settings.exitRollRight' },
]

export const galleryItems = [
  { id: 'wheelActions', labelKey: 'gallery.wheelActions', sourceView: 'wheel' },
  { id: 'topDonors', labelKey: 'gallery.donorLeaderboard', sourceView: 'top-donors' },
  { id: 'topTappers', labelKey: 'gallery.tapperLeaderboard', sourceView: 'top-tappers' },
]

export const railItems = [
  { labelKey: 'nav.start', icon: Home, routeName: 'start' },
  { labelKey: 'nav.setup', icon: Settings, routeName: 'setup' },
  { labelKey: 'nav.overlays', icon: Monitor, routeName: 'studio' },
  { labelKey: 'nav.actions', icon: Zap, routeName: 'actions' },
  { labelKey: 'nav.interactions', icon: Keyboard, routeName: 'interactions' },
  { labelKey: 'nav.interactiveGames', icon: Gamepad2, routeName: 'interactive-games' },
  { labelKey: 'nav.sounds', icon: Volume2, routeName: 'sounds' },
  { labelKey: 'nav.chat', icon: MessageCircle, routeName: 'chat' },
  { labelKey: 'nav.points', icon: Trophy, routeName: 'points' },
  { labelKey: 'nav.song', icon: Music2, routeName: 'song' },
  { labelKey: 'nav.tools', icon: Wrench, routeName: 'tools' },
  { labelKey: 'nav.maintenance', icon: HardDrive, routeName: 'maintenance' },
  { labelKey: 'nav.admin', icon: ShieldCheck, routeName: 'admin' },
  { labelKey: 'nav.liveRecaps', icon: CalendarDays, routeName: 'lives' },
]
