public with sharing class PricebookAutomationHandler {
    
    /**
     * Handles Pricebook activation/deactivation when Academic Year status changes
     * @param newYears List of Academic_Year__c records from trigger
     * @param oldMap Map of old Academic_Year__c records
     */
    public static void handleStatusChange(List<Academic_Year__c> newYears, Map<Id, Academic_Year__c> oldMap) {
        Set<Id> activatedYearIds = new Set<Id>();
        
        for (Academic_Year__c ay : newYears) {
            Boolean wasActive = oldMap != null && oldMap.containsKey(ay.Id) ? oldMap.get(ay.Id).Is_Active__c : false;
            if (ay.Is_Active__c && !wasActive) {
                activatedYearIds.add(ay.Id);
            }
        }
        
        if (!activatedYearIds.isEmpty()) {
            automatePricebooks(activatedYearIds);
        }
    }
    
    /**
     * Activates Pricebooks for the new year(s) and deactivates others
     * @param activeYearIds IDs of the newly activated Academic Years
     */
    private static void automatePricebooks(Set<Id> activeYearIds) {
        List<Pricebook2> pricebooksToUpdate = new List<Pricebook2>();
        
        // 1. Activate Pricebooks for the new active years
        List<Pricebook2> toActivate = [
            SELECT Id, IsActive 
            FROM Pricebook2 
            WHERE Academic_Year__c IN :activeYearIds 
            AND IsActive = false
        ];
        
        for (Pricebook2 pb : toActivate) {
            pb.IsActive = true;
            pricebooksToUpdate.add(pb);
        }
        
        // 2. Deactivate active Pricebooks linked to OTHER academic years
        // Note: We don't deactivate standard pricebooks or those without an academic year 
        // unless they are explicitly meant for fees.
        List<Pricebook2> toDeactivate = [
            SELECT Id, IsActive 
            FROM Pricebook2 
            WHERE Academic_Year__c IN (SELECT Id FROM Academic_Year__c WHERE Is_Active__c = false)
            AND IsActive = true
            AND IsStandard = false
        ];
        
        for (Pricebook2 pb : toDeactivate) {
            pb.IsActive = false;
            pricebooksToUpdate.add(pb);
        }
        
        if (!pricebooksToUpdate.isEmpty()) {
            update pricebooksToUpdate;
            System.debug('Pricebook Automation: Updated ' + pricebooksToUpdate.size() + ' pricebooks.');
        }
    }
}