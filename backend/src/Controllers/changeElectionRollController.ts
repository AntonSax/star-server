import { ElectionRoll, ElectionRollState } from "../../../domain_model/ElectionRoll";
import ServiceLocator from "../ServiceLocator";
import Logger from "../Services/Logging/Logger";
import { responseErr } from "../Util";

const EmailService = require('../Services/EmailService')
const ElectionRollModel = ServiceLocator.electionRollDb();
import { hasPermission, permission, permissions } from '../../../domain_model/permissions';
import { expectPermission } from "./controllerUtils";
import { InternalServerError, Unauthorized } from "@curveball/http-errors";

const className = "VoterRollState.Controllers";

const approveElectionRoll = async (req: any, res: any, next: any) => {
    Logger.info(req, `${className}.approveElectionRoll ${req.params.id}`);
    changeElectionRollState(req, ElectionRollState.approved, [ElectionRollState.registered, ElectionRollState.flagged], permissions.canApproveElectionRoll)
    res.status('200').json()
}

const flagElectionRoll = async (req: any, res: any, next: any) => {
    Logger.info(req, `${className}.flagElectionRoll ${req.params.id}`);
    changeElectionRollState(req, ElectionRollState.flagged, [ElectionRollState.approved, ElectionRollState.registered, ElectionRollState.invalid], permissions.canFlagElectionRoll)
    res.status('200').json()
}

const invalidateElectionRoll = async (req: any, res: any, next: any) => {
    Logger.info(req, `${className}.flagElectionRoll ${req.params.id}`);
    changeElectionRollState(req, ElectionRollState.invalid, [ElectionRollState.flagged], permissions.canInvalidateBallot)
    res.status('200').json()
}

const uninvalidateElectionRoll = async (req: any, res: any, next: any) => {
    Logger.info(req, `${className}.flagElectionRoll ${req.params.id}`);
    changeElectionRollState(req, ElectionRollState.flagged, [ElectionRollState.invalid], permissions.canInvalidateBallot)
    res.status('200').json()
}

const changeElectionRollState = async (req: any, newState: ElectionRollState, validStates: ElectionRollState[], permission: permission) => {
    expectPermission(req.user_auth.roles, permission)
    req.electionRollEntry = await ElectionRollModel.getByVoterID(req.election.election_id, req.body.electionRollEntry.voter_id, req)
    const currentState = req.electionRollEntry.state
    if (!validStates.includes(currentState)) {
        throw new Unauthorized('Invalid election roll state transition')
    }
    req.electionRollEntry.state = newState;
    if (req.electionRollEntry.history == null) {
        req.electionRollEntry.history = [];
    }
    req.electionRollEntry.history.push([{
        action_type: newState,
        actor: req.user.email,
        timestamp: Date.now(),
    }])
    const updatedEntry = await ElectionRollModel.update(req.electionRollEntry, req, "Changing Election Roll state to " + newState);
    if (!updatedEntry) {
        const msg = "Could not change election roll state";
        Logger.error(req, "= = = = = = \n = = = = = ");
        Logger.info(req, msg);
        throw new InternalServerError(msg);
    }
}

module.exports = {
    changeElectionRollState,
    approveElectionRoll,
    flagElectionRoll,
    invalidateElectionRoll,
    uninvalidateElectionRoll
}
