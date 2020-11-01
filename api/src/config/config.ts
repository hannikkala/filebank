import convict from 'convict';
import { defaults } from './defaults';

const config = convict(defaults);

config.validate();

export default config;
