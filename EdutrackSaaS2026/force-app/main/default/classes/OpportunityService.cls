public WITHOUT SHARING class OpportunityService {
    /**
     * Recalculates the Total_Paid_Amount__c on Opportunities based on related Invoice Items.
     * Centralized logic used by Invoice and InvoiceItem triggers.
     */
    public static void recalculatePaidAmount(Set<Id> oppIds) {
        if (oppIds == null || oppIds.isEmpty()) {
            return;
        }

        Map<Id, Decimal> oppPaidMap = new Map<Id, Decimal>();
        for (Id oppId : oppIds) {
            oppPaidMap.put(oppId, 0);
        }

        // Fetch all non-cancelled invoice items for the affected opportunities
        // Background logic: bypass FLS to ensure data integrity
        List<Invoice_Item__c> items = (List<Invoice_Item__c>)Security.stripInaccessible(AccessType.READABLE, [
            SELECT Amount__c, Invoice__r.Opportunity__c 
            FROM Invoice_Item__c 
            WHERE Invoice__r.Opportunity__c IN :oppIds
            AND Invoice__r.Status__c != 'Cancelled'
            LIMIT 5000
        ]).getRecords();
        
        for (Invoice_Item__c item : items) {
            Id oppId = (Id)NamespaceUtils.getValue(item, 'Invoice__r.Opportunity__c');
            if (oppId != null && oppPaidMap.containsKey(oppId)) {
                Decimal current = oppPaidMap.get(oppId);
                Decimal amt = (Decimal)NamespaceUtils.getValue(item, 'Amount__c');
                oppPaidMap.put(oppId, current + (amt != null ? amt : 0));
            }
        }

        List<Opportunity> oppsToUpdate = new List<Opportunity>();
        for (Id oppId : oppPaidMap.keySet()) {
            oppsToUpdate.add(new Opportunity(
                Id = oppId,
                Total_Paid_Amount__c = oppPaidMap.get(oppId)
            ));
        }

        if (!oppsToUpdate.isEmpty()) {
            if (!Schema.sObjectType.Opportunity.isUpdateable()) {
                throw new AuraHandledException('Insufficient permissions to update opportunities.');
            }
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, oppsToUpdate);
            update decision.getRecords();
        }
    }
}
