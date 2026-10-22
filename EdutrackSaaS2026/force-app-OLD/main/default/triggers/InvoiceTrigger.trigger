trigger InvoiceTrigger on Invoice__c (after update) {
    Set<Id> oppIds = new Set<Id>();
    
    for (Invoice__c inv : Trigger.new) {
        Invoice__c oldInv = Trigger.oldMap.get(inv.Id);
        // If status changed, we need to recalculate the related Opportunity balances
        if (inv.Status__c != oldInv.Status__c && inv.Opportunity__c != null) {
            oppIds.add(inv.Opportunity__c);
        }
    }
    
    if (oppIds.isEmpty()) return;
    
    // We can reuse the logic from InvoiceItemTrigger by querying for all items
    // under these Opportunities and updating the Total_Paid_Amount__c.
    
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