public with sharing class VikasSchoolController {
    /**
     * A simple method to return a welcome message from Apex.
     */
    @AuraEnabled(cacheable=true)
    public static String getWelcomeMessage() {
        return 'Welcome to Vikas School! This message is coming directly from a Salesforce Apex Class.';
    }

    /**
     * Placeholder method to fetch school details or students in the future.
     */
    @AuraEnabled(cacheable=true)
    public static List<Account> getSchoolDetails() {
        // Just returning a dummy search or limit for now
        return [SELECT Id, Name, Type FROM Account LIMIT 5];
    }
}