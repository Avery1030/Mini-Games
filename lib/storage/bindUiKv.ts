import { registerUiKvStorage } from '@/components/ui/kvStorage'
import { appStorage } from './local'

registerUiKvStorage({
  getItem: (key) => appStorage.getLoose(key),
  setItem: (key, value) => appStorage.setLoose(key, value),
})
