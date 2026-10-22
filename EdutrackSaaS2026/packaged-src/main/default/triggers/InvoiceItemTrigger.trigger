trigger InvoiceItemTrigger on Invoice_Item__c (after insert, after update, after delete, after undelete) {
    Set<Id> invoiceIds = new Set<Id>();
    
    if (Trigger.isInsert || Trigger.isUpdate || Trigger.isUndelete) {
        for (Invoice_Item__c item : Trigger.new) {
            if (item.Invoice__c != null) invoiceIds.add(item.Invoice__c);
        }
    }
    
    if (Trigger.isDelete || Trigger.isUpdate) {
        for (Invoice_Item__c item : Trigger.old) {
            if (item.Invoice__c != null) invoiceIds.add(item.Invoice__c);
        }
    }
    
    if (invoiceIds.isEmpty()) return;
    
    // Get related Opportunity IDs
    Set<Id> oppIds = new Set<Id>();
    for (Invoice__c inv : [SELECT Opportunity__c FROM Invoice__c WHERE Id IN :invoiceIds]) {
        if (inv.Opportunity__c != null) oppIds.add(inv.Opportunity__c);
    }
    
    if (oppIds.isEmpty()) return;
    
    // Calculate totals for each Opportunity
    Map<Id, Decimal> oppPaidMap = new Map<Id, Decimal>();
    for (Id oppId : oppIds) oppPaidMap.put(oppId, 0);
    
    for (Invoice_Item__c item : [
        SELECT Amount__c, Invoice__r.Opportunity__c 
        FROM Invoice_Item__c 
        WHERE Invoice__r.Opportunity__c IN :oppIds
        AND Invoice__r.Status__c != 'Cancelled'
    ]) {
        Id oppId = item.Invoice__r.Opportunity__c;
        Decimal current = oppPaidMap.get(oppId);
        oppPaidMap.put(oppId, current + (item.Amount__c != null ? item.Amount__c : 0));
    }
    
    List<Opportunity> oppsToUpdate = new List<Opportunity>();
    for (Id oppId : oppPaidMap.keySet()) {
        oppsToUpdate.add(new Opportunity(
            Id = oppId,
            Total_Paid_Amount__c = oppPaidMap.get(oppId)
        ));
    }
    
    if (!oppsToUpdate.isEmpty()) {
        update oppsToUpdate;
    }
}