import overview from './overview'
import channels from './channels'
import accounts from './accounts'
import resources from './resources'
import ops from './ops'
import settings from './settings'
import audit from './audit'
import plugins from './plugins'
import modelHealth from './modelHealth'
import supplierHall from './supplierHall'
import balanceBilling from './balanceBilling'
import imageRecords from './imageRecords'

export default {
  ...overview,
  ...channels,
  ...accounts,
  ...resources,
  ...ops,
  ...settings,
  ...audit,
  ...plugins,
  ...modelHealth,
  ...supplierHall,
  ...balanceBilling,
  ...imageRecords,
}
