const express = require("express");
const { db, check } = require("../db");
const { portalSession } = require("../security");
const { uuid, rpcRoute } = require("../services/rpc");
const router = express.Router();
router.use(portalSession);
const invalid = () => {
  const e = Error("Invalid project data.");
  e.validation = true;
  throw e;
};
function validate(action, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) invalid();
  const allowed = {
    create: [
      "key",
      "name",
      "description",
      "kind",
      "customerOrganizationId",
      "ownerId",
      "priority",
      "startsOn",
      "dueOn",
      "clientVisible",
      "products",
      "managerUserId",
    ],
    update: [
      "version",
      "name",
      "description",
      "ownerId",
      "status",
      "priority",
      "dueOn",
      "clientVisible",
      "products",
    ],
    "member.save": ["version", "userId", "role", "status", "team"],
    "milestone.create": ["version", "title", "dueOn", "shared"],
    "milestone.update": [
      "version",
      "id",
      "title",
      "status",
      "dueOn",
      "dependsOn",
      "shared",
    ],
    "task.create": [
      "version",
      "title",
      "description",
      "priority",
      "dueOn",
      "assigneeId",
      "milestoneId",
      "shared",
    ],
    "task.update": [
      "version",
      "id",
      "title",
      "description",
      "priority",
      "dueOn",
      "assigneeId",
      "milestoneId",
      "status",
      "shared",
    ],
    "comment.create": ["version", "body", "taskId", "shared"],
    "deliverable.create": ["version", "title", "url", "taskId", "shared"],
  }[action];
  if (!allowed || Object.keys(data).some((k) => !allowed.includes(k)))
    invalid();
  if (
    action !== "create" &&
    (!Number.isSafeInteger(data.version) || data.version < 1)
  )
    invalid();
  for (const k of [
    "id",
    "userId",
    "ownerId",
    "customerOrganizationId",
    "milestoneId",
    "taskId",
    "assigneeId",
    "dependsOn",
    "managerUserId",
  ])
    if (
      data[k] !== undefined &&
      data[k] !== null &&
      data[k] !== "" &&
      !uuid(data[k])
    )
      invalid();
  for (const [key, max] of [
    ["name", 150],
    ["title", 200],
    ["description", 5000],
    ["body", 4000],
    ["team", 100],
  ])
    if (
      data[key] !== undefined &&
      (typeof data[key] !== "string" ||
        data[key].length > max ||
        (["name", "title", "body"].includes(key) && !data[key].trim()))
    )
      invalid();
  for (const k of ["startsOn", "dueOn"])
    if (
      data[k] &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(data[k]) ||
        Number.isNaN(Date.parse(data[k])))
    )
      invalid();
  for (const k of ["shared", "clientVisible"])
    if (data[k] !== undefined && typeof data[k] !== "boolean") invalid();
  if (
    data.priority &&
    !["low", "normal", "high", "urgent"].includes(data.priority)
  )
    invalid();
  if (
    data.products !== undefined &&
    (!Array.isArray(data.products) ||
      data.products.length > 20 ||
      new Set(data.products).size !== data.products.length ||
      data.products.some((id) => !uuid(id)))
  )
    invalid();
  if (
    action === "create" &&
    (!/^[A-Z][A-Z0-9-]{1,19}$/.test(data.key || "") ||
      !data.name ||
      !["internal", "customer"].includes(data.kind) ||
      (data.kind === "customer") !== Boolean(data.customerOrganizationId))
  )
    invalid();
  if (action.endsWith(".create") && !(data.title || data.body)) invalid();
  if (action.endsWith(".update") && !uuid(data.id)) invalid();
  if (
    action === "member.save" &&
    (!uuid(data.userId) ||
      !["manager", "contributor", "viewer", "client"].includes(data.role) ||
      !["active", "revoked"].includes(data.status))
  )
    invalid();
  if (data.url !== undefined) {
    try {
      const u = new URL(data.url);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        data.url.length > 2000
      )
        invalid();
    } catch {
      invalid();
    }
  }
  return data;
}
const call = (req, action, id, data) =>
  db()
    .rpc("project_command", {
      p_actor: req.user.id,
      p_action: action,
      p_id: id || null,
      p_data: data || {},
    })
    .then(check);
router.get(
  "/",
  rpcRoute((req) => {
    if (req.query.cursor && !uuid(req.query.cursor)) invalid();
    return call(req, "list", null, {
      q: String(req.query.q || "").slice(0, 100),
      status: String(req.query.status || ""),
      cursor: req.query.cursor || null,
    });
  }),
);
const workforce=(req,action,payload={},project=req.params.id||null)=>db().rpc("project_workforce_command",{
  p_actor:req.user.id,p_action:action,p_project:project,p_data:payload,
}).then(check);
function workforceData(action,data) {
  if(!data||typeof data!=="object"||Array.isArray(data))invalid();
  const keys=action==="assign"?["version","userId","role","team"]:["version","userId"];
  if(Object.keys(data).length!==keys.length||keys.some(k=>!Object.hasOwn(data,k))||
     !Number.isSafeInteger(data.version)||data.version<1||!uuid(data.userId))invalid();
  if(action==="assign"&&(!["manager","contributor","viewer"].includes(data.role)||
     typeof data.team!=="string"||data.team.length>100))invalid();
  return data;
}
router.get("/manager-overview",rpcRoute(req=>{
  if(Object.keys(req.query).length)invalid();
  return workforce(req,"overview",{},null);
}));
router.get("/:id/workforce",rpcRoute(req=>{
  if(!uuid(req.params.id)||Object.keys(req.query).length)invalid();
  return workforce(req,"directory");
}));
const staffActions={"assign":"assign","remove":"remove","manager-grant":"manager.grant","manager-revoke":"manager.revoke"};
router.post("/:id/workforce/:action",rpcRoute(req=>{
  if(!uuid(req.params.id)||!Object.hasOwn(staffActions,req.params.action))invalid();
  const action=staffActions[req.params.action];
  return workforce(req,action,workforceData(action,req.body));
}));
router.get(
  "/directory",
  rpcRoute((req) => {
    if (req.query.projectId && !uuid(req.query.projectId)) invalid();
    return call(req, "directory", req.query.projectId, {
      email: String(req.query.email || "").slice(0, 254),
    });
  }),
);
router.get("/manager-candidates",rpcRoute(async req=>{
  if(Object.keys(req.query).length)invalid();
  try {
    return await db().rpc("project_creation_command",{p_actor:req.user.id,p_action:"managers",p_data:{}}).then(check);
  } catch(error) {
    // Existing hosted schema can still create owner-managed projects while
    // the reviewed new manager-appointment migration awaits release.
    if(!["PGRST202","42883"].includes(error.code))throw error;
    return {managers:[],schemaReady:false};
  }
}));
router.post(
  "/",
  rpcRoute(async (req, res) => {
    const data=validate("create",req.body);
    let result;
    if(Object.hasOwn(data,"managerUserId")) {
      try {
        result=await db().rpc("project_creation_command",{
          p_actor:req.user.id,p_action:"create",p_data:data
        }).then(check);
      }catch(error){
        if(!["PGRST202","42883"].includes(error.code))throw error;
        if(data.managerUserId){
          const pending=Error("Project-manager appointment requires the reviewed database upgrade. No project was created.");
          pending.validation=true;throw pending;
        }
        result=await call(req,"create",null,(({
          managerUserId:discard,...fields
        })=>fields)(data));
      }
    } else result=await call(req,"create",null,data);
    res.status(201);
    return result;
  }),
);
router.get(
  "/:id",
  rpcRoute((req) => {
    if (!uuid(req.params.id)) invalid();
    return call(req, "detail", req.params.id);
  }),
);
router.patch(
  "/:id",
  rpcRoute((req) => {
    if (!uuid(req.params.id)) invalid();
    return call(req, "update", req.params.id, validate("update", req.body));
  }),
);
router.post("/:id/members",rpcRoute(req=>{
  if(!uuid(req.params.id))invalid();
  const data=validate("member.save",req.body);
  if(data.role==="client")return call(req,"member.save",req.params.id,data);
  if(data.status==="revoked")return workforce(req,"remove",{version:data.version,userId:data.userId});
  return workforce(req,"assign",{version:data.version,userId:data.userId,role:data.role,team:data.team||""});
}));
const actions = {
  milestones: "milestone.create",
  tasks: "task.create",
  comments: "comment.create",
  deliverables: "deliverable.create",
};
for (const [path, action] of Object.entries(actions))
  router.post(
    "/:id/" + path,
    rpcRoute((req) => {
      if (!uuid(req.params.id)) invalid();
      return call(req, action, req.params.id, validate(action, req.body));
    }),
  );
for (const [path, action] of [
  ["tasks", "task.update"],
  ["milestones", "milestone.update"],
])
  router.patch(
    "/:id/" + path + "/:entity",
    rpcRoute((req) => {
      if (!uuid(req.params.id) || !uuid(req.params.entity)) invalid();
      return call(
        req,
        action,
        req.params.id,
        validate(action, { ...req.body, id: req.params.entity }),
      );
    }),
  );

function validateCustomApplication(data,updating=false){
  if(!data||typeof data!=="object"||Array.isArray(data))invalid();
  const keys=["name","description","status","repositoryUrl","deploymentUrl","shared"];
  if(updating)keys.push("version");
  if(Object.keys(data).length!==keys.length||keys.some(k=>!Object.hasOwn(data,k)))invalid();
  if(typeof data.name!=="string"||data.name.trim().length<1||data.name.trim().length>150||
    typeof data.description!=="string"||data.description.length>2000||
    !["planned","building","testing","live","paused","retired"].includes(data.status)||
    typeof data.shared!=="boolean")invalid();
  const validated={...data,name:data.name.trim()};
  for(const key of ["repositoryUrl","deploymentUrl"]){
    const raw=data[key];
    if(typeof raw!=="string"||raw.length>1000)invalid();
    if(!raw)continue;
    let parsed;
    try{parsed=new URL(raw)}catch{invalid();}
    if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.search||parsed.hash||
       !/^https:\/\/[A-Za-z0-9.-]+(?::[0-9]{1,5})?(?:\/[A-Za-z0-9._~/%-]*)?$/.test(raw))
      invalid();
  }
  if(updating&&(!Number.isSafeInteger(data.version)||data.version<1||data.version>2147483646))invalid();
  return validated;
}
const customApplication=(req,action,id,payload)=>
  db().rpc("project_custom_application_command",{
    p_actor:req.user.id,p_action:action,p_project:req.params.id,
    p_id:id||null,p_data:payload||{},
  }).then(check);
router.get("/:id/applications",rpcRoute(req=>{
  if(!uuid(req.params.id)||Object.keys(req.query).length)invalid();
  return customApplication(req,"list",null,{});
}));
router.post("/:id/applications",rpcRoute(req=>{
  if(!uuid(req.params.id)||Object.keys(req.query).length)invalid();
  const data=validateCustomApplication(req.body);
  return customApplication(req,"create",null,data);
}));
router.patch("/:id/applications/:applicationId",rpcRoute(req=>{
  if(!uuid(req.params.id)||!uuid(req.params.applicationId)||Object.keys(req.query).length)invalid();
  const data=validateCustomApplication(req.body,true);
  return customApplication(req,"update",req.params.applicationId,data);
}));

const { rateLimit } = require("../http-security");
const rateLimitLifecycle=rateLimit({limit:12,windowMs:15*60*1000});

// Soft-archive is available for any existing owner project. Permanent deletion
// only succeeds if the project was archived and no retained dependencies exist.
router.post("/:id/lifecycle/:action",rateLimitLifecycle,rpcRoute(req=>{
  if(!uuid(req.params.id)||!["archive","delete"].includes(req.params.action))invalid();
  const data=req.body;
  if(!data||typeof data!=="object"||Array.isArray(data)||
    Object.keys(data).length!==3||
    !Object.hasOwn(data,"version")||!Object.hasOwn(data,"key")||!Object.hasOwn(data,"confirmed")||
    !Number.isSafeInteger(data.version)||data.version<1||data.version>999999999||
    data.confirmed!==true||typeof data.key!=="string"||
    !/^[A-Z][A-Z0-9-]{1,19}$/.test(data.key))invalid();
  return db().rpc("project_lifecycle_command",{
    p_actor:req.user.id,p_action:req.params.action,p_project:req.params.id,p_data:data
  }).then(check).catch(error=>{
    if(error.code==="23503"){
      const denied=Error("Project has linked work, records or external references. Keep it archived; only empty archived projects can be permanently deleted.");
      denied.validation=true;throw denied;
    }
    throw error;
  });
}));

module.exports = { router, validate, validateCustomApplication, workforceData };
