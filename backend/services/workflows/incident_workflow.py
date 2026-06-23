class IncidentWorkflow:

    @staticmethod
    def handle(request, conversation, current_user, db):

        return {
            "status": "continue"
        }