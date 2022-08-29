import { Election, electionValidation } from '../../../domain_model/Election';
import ServiceLocator from '../ServiceLocator';
import Logger from '../Services/Logging/Logger';
import { responseErr } from '../Util';
import { IRequest } from '../IRequest';
import { roles } from "../../../domain_model/roles"


var ElectionsModel =  ServiceLocator.electionsDb();
const className="Elections.Controllers";

const getElectionByID = async (req: any, res: any, next: any) => {
    Logger.info(req, `${__filename}.getElectionByID ${req.params.id}`);
    try {
        var election = await ElectionsModel.getElectionByID(req.params.id, req);
        Logger.debug(req, `get election ${req.params.id}`);
        var failMsg = "Election not found";
        if (!election) {
            Logger.info(req, `${failMsg} electionId=${req.params.id}}`);
            return responseErr(res, req, 400, failMsg);
        }
        // Update Election State
        election = await updateElectionStateIfNeeded(req, election);

        req.election = election

        req.user_auth = {}
        req.user_auth.roles = []
        if (req.user && req.election){
          if (req.user.sub === req.election.owner_id){
            req.user_auth.roles.push(roles.owner)
          }
          if (req.election.admin_ids && req.election.admin_ids.includes(req.user.email)){
            req.user_auth.roles.push(roles.admin)
          }
          if (req.election.audit_ids && req.election.audit_ids.includes(req.user.email)){
            req.user_auth.roles.push(roles.auditor)
          }
          if (req.election.credential_ids && req.election.credential_ids.includes(req.user.email)){
            req.user_auth.roles.push(roles.credentialer)
          }
        }
        Logger.debug(req,req.user_auth)
        return next()
    } catch (err:any) {
        var failMsg = "Could not retrieve election";
        Logger.error(req, `${failMsg} ${err.message}`);
        return responseErr(res, req, 500, failMsg);
    }
}

async function updateElectionStateIfNeeded(req:IRequest, election:Election):Promise<Election> {
    if (election.state === 'draft') {
        return election;
    }

    const currentTime = new Date();
    var stateChange = false;
    var stateChangeMsg = "";

    if (election.state === 'finalized') {
        var openElection = false;
        if (election.start_time) {
            const startTime = new Date(election.start_time);
            if (currentTime.getTime() > startTime.getTime()) {
                openElection = true;
            }
        } else {
            openElection = true;
        }
        if (openElection){
            stateChange = true;
            election.state = 'open';
            stateChangeMsg = `Election ${election.election_id} Transitioning to Open From ${election.state} (start time = ${election.start_time})`;
        }
    }
    if (election.state === 'open') {
        if (election.end_time) {
            const endTime = new Date(election.end_time);
            if (currentTime.getTime() > endTime.getTime()) {
                stateChange = true;
                election.state = 'closed';
                stateChangeMsg = `Election ${election.election_id} transitioning to Closed From ${election.state} (end time = ${election.end_time})`;
            }
        }
    }
    if (stateChange) {
        election = await ElectionsModel.updateElection(election, req, stateChangeMsg);
        Logger.info(req, stateChangeMsg);
    }
    return election;
}

const returnElection = async (req: any, res: any, next: any) => {
    Logger.info(req, `${className}.returnElection ${req.params.id}`)
    res.json({ election: req.election, voterAuth: { authorized_voter: req.authorized_voter, has_voted: req.has_voted, roles: req.user_auth.roles} })
}

module.exports = {
    returnElection,
    getElectionByID,
}