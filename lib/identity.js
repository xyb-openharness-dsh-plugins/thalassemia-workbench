/* 身份与路径的唯一源（零依赖，客户端构建与服务端都从这里取，不许手抄第二份）。 */
export const PLUGIN_ID = 'ferropal-workbench-main'
export const API_PREFIX = '/api/ferropal-workbench'
export const UI_PREFIX = '/ui'
export const HOME_DIR = 'ferropal-workbench' // dshHomePath('ferropal-workbench')
export const DB_FILE = 'xyb-ferropal.sqlite'
export const UI_ENTRY = `${API_PREFIX}${UI_PREFIX}/`
