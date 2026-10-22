public without sharing class InvoiceItemTriggerHandler {
    /**
     * Entry point for After Insert, Update, Delete, Undelete on Invoice_Item__c
     */
    public void onAfterInsert(List<Invoice_Item__c> newList) {
        processAffectedInvoices(newList);
    }

    public void onAfterUpdate(List<Invoice_Item__c> newList, Map<Id, Invoice_Item__c> oldMap) {
        processAffectedInvoices(newList);
        processAffectedInvoices(oldMap.values());
    }

    public void onAfterDelete(List<Invoice_Item__c> oldList) {
        processAffectedInvoices(oldList);
    }

    public void onAfterUndelete(List<Invoice_Item__c> newList) {
        processAffectedInvoices(newList);
    }

    /**
     * Identifies affected Opportunities and calls recalculation
     */
    private void processAffectedInvoices(List<Invoice_Item__c> items) {
        Set<Id> invoiceIds = new Set<Id>();
        for (Invoice_Item__c item : items) {
            if (item.Invoice__c != null) {
                invoiceIds.add(item.Invoice__c);
            }
        }
        
        if (invoiceIds.isEmpty()) return;
        
        // Recalculate related Opportunities
        Set<Id> oppIds = new Set<Id>();
        for (Invoice__c inv : (List<Invoice__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Opportunity__c FROM Invoice__c WHERE Id IN :invoiceIds LIMIT 1000]).getRecords()) {
            Id oppId = (Id)NamespaceUtils.getValue(inv, 'Opportunity__c');
            if (oppId != null) {
                oppIds.add(oppId);
            }
        }
        
        if (!oppIds.isEmpty()) {
            OpportunityService.recalculatePaidAmount(oppIds);
        }
    }
}
