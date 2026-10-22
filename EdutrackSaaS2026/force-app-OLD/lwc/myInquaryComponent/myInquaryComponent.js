import { LightningElement } from 'lwc';
import SA6 from '@salesforce/resourceUrl/SA6';


export default class MyInquiryComponent extends LightningElement {
image1 = SA6;

    isModalOpen = false;

    openModal() {
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
    }

    handleProceed() {
        // Add logic for "Proceed to Contact" action if needed
        this.closeModal();
    }
}