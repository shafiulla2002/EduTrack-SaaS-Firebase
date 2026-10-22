trigger AcademicYearTrigger on Academic_Year__c (after update) {
    if (Trigger.isAfter && Trigger.isUpdate) {
        PricebookAutomationHandler.handleStatusChange(Trigger.new, Trigger.oldMap);
    }
}