trigger InvoiceItemTrigger on Invoice_Item__c (after insert, after update, after delete, after undelete) {
    InvoiceItemTriggerHandler handler = new InvoiceItemTriggerHandler();
    
    if (Trigger.isAfter) {
        if (Trigger.isInsert) {
            handler.onAfterInsert(Trigger.new);
        } else if (Trigger.isUpdate) {
            handler.onAfterUpdate(Trigger.new, Trigger.oldMap);
        } else if (Trigger.isDelete) {
            handler.onAfterDelete(Trigger.old);
        } else if (Trigger.isUndelete) {
            handler.onAfterUndelete(Trigger.new);
        }
    }
}