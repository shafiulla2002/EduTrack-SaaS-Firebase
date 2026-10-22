trigger InvoiceTrigger on Invoice__c (after update) {
    InvoiceTriggerHandler handler = new InvoiceTriggerHandler();
    
    if (Trigger.isAfter && Trigger.isUpdate) {
        handler.onAfterUpdate(Trigger.new, Trigger.oldMap);
    }
}