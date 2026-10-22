public with sharing class InvoiceTriggerHandler {
    /**
     * Entry point for After Update trigger on Invoice__c
     */
    public void onAfterUpdate(List<Invoice__c> newList, Map<Id, Invoice__c> oldMap) {
        Set<Id> oppIds = new Set<Id>();
        
        for (Invoice__c inv : newList) {
            Invoice__c oldInv = oldMap.get(inv.Id);
            // If status changed, we need to recalculate the related Opportunity balances
            if (inv.Status__c != oldInv.Status__c && inv.Opportunity__c != null) {
                oppIds.add(inv.Opportunity__c);
            }
        }
        
        if (!oppIds.isEmpty()) {
            OpportunityService.recalculatePaidAmount(oppIds);
        }
    }
}
