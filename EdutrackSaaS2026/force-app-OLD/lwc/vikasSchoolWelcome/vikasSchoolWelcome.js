import { LightningElement, track } from 'lwc';

export default class VikasSchoolWelcome extends LightningElement {
    @track currentTime = new Date().toLocaleTimeString();

    connectedCallback() {
        this.timer = setInterval(() => {
            this.currentTime = new Date().toLocaleTimeString();
        }, 1000);
    }

    disconnectedCallback() {
        clearInterval(this.timer);
    }
}