trigger TimeEntryTrigger on Time_Entry__c (before update) {

    // Prevent modification of submitted time entries
    if (Trigger.isBefore && Trigger.isUpdate) {
        for (Time_Entry__c newTimeEntry : Trigger.new) {
            Time_Entry__c oldTimeEntry = Trigger.oldMap.get(newTimeEntry.Id);

            // If the record was already submitted (IsSubmitted__c was true)
            // AND it's still submitted (IsSubmitted__c is true in the new version)
            // AND any of the 'editable' fields are being changed
            if (oldTimeEntry.IsSubmitted__c == true &&
                newTimeEntry.IsSubmitted__c == true) { // This ensures the initial setting to true is allowed

                // Check for changes in the fields you want to lock
                if (newTimeEntry.Hours_Spent__c != oldTimeEntry.Hours_Spent__c ||
                    newTimeEntry.Description__c != oldTimeEntry.Description__c ||
                    newTimeEntry.Project_Workstream__c != oldTimeEntry.Project_Workstream__c) {

                    // Add an error to prevent the update
                    newTimeEntry.addError('Submitted time entries cannot be modified.');
                }
            }
        }
    }
}