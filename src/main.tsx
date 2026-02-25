import './index.css';
import { UIController } from './app/UIController';

const root = document.getElementById('root');
if (root) {
  const app = new UIController(root);
  app.init();
}
