import { LightningElement } from 'lwc';

export default class WhoAreWe extends LightningElement {
    renderedCallback() {
        // Load Inter Variable font
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,8..144,100..900;1,8..144,100..900&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        // Debug icon rendering
        const handshakeIcon = this.template.querySelector('.commitment-icon');
        const lightBulbIcon = this.template.querySelector('.vision-icon svg');
        if (!handshakeIcon) {
            console.error('Handshake icon (commitment-icon) not found in DOM');
        } else {
            console.log('Handshake icon (commitment-icon) found:', handshakeIcon);
        }
        if (!lightBulbIcon) {
            console.error('Light bulb SVG (vision-icon) not found in DOM');
        } else {
            console.log('Light bulb SVG (vision-icon) found:', lightBulbIcon);
        }
    }
}