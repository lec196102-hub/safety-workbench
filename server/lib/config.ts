// 后端统一配置入口：从 JSON 文件加载所有配置数据，实现逻辑与数据分离
import appConfig from '../../src/data/app-config.json';
import hazardConfig from '../../src/data/hazard-config.json';
import seedHazards from '../data/seed-hazards.json';

export { appConfig, hazardConfig, seedHazards };
