import { realpath, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import { parseRestaurantId } from './catalog.service.js';
import { getAdminRecord, listAdminRecords, adminDashboard, withAdminTransaction, lockAdminActor, lockRestaurants, emailExists, saveAdminRecord, descendantPhotos } from '../models/admin.model.js';

export class AdminError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const invalid = message => { throw new AdminError(400, message); };
const schema = {
  restaurantes:{nombre:200,rut:11,fono:45,email:100,mapa:200,foto:200,calle:100,numero:15,comuna:100,region:100,activo:'boolean'},
  cartas:{nombre:45,restautantes_id:'id',orden:'integer',foto:200,activo:'boolean'},
  categorias:{nombre:100,cartas_id:'id',orden:'integer',foto:200,activo:'boolean'},
  productos:{nombre:100,categorias_id:'id',precio:'integer',descripcion:300,observaciones:300,tiempo:100,foto:200,orden:'integer',destacado:'boolean',disponible:'boolean',activo:'boolean'},
  usuarios:{nombre:255,email:255,password:'password',rol:'role',restaurantes:'ids',activo:'boolean'}
};
const required = {restaurantes:['nombre','rut','fono','calle','numero','comuna'],cartas:['nombre','restautantes_id'],categorias:['nombre','cartas_id'],productos:['nombre','categorias_id','precio'],usuarios:['nombre','email','password']};
const nullable = new Set(['email','mapa','foto','region','orden','descripcion','observaciones','tiempo']);
export function validateAdminInput(resource, body, creating = false) {
  if (!Object.hasOwn(schema,resource)) invalid('Recurso desconocido');
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length) invalid('Datos inválidos');
  const data = {};
  for (const [key,value] of Object.entries(body)) {
    if (!Object.hasOwn(schema[resource],key)) invalid(`Campo no permitido: ${key}`);
    const rule = schema[resource][key];
    if (value === null && nullable.has(key) && !(resource === 'usuarios' && key === 'email')) { data[key] = null; continue; }
    if (typeof rule === 'number') {
      if (typeof value !== 'string' || value.trim().length > rule || value.includes('\0')) invalid(`Campo inválido: ${key}`);
      data[key] = value.trim();
      if ((key === 'nombre' || required[resource].includes(key)) && !data[key]) invalid(`Campo requerido: ${key}`);
      if (key === 'email' && data[key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data[key])) invalid('Email inválido');
    } else if (rule === 'boolean') {
      if (typeof value !== 'boolean') invalid(`Campo inválido: ${key}`);
      data[key] = value;
    } else if (rule === 'id' || rule === 'integer') {
      if (!Number.isInteger(value) || value < (rule === 'id' ? 1 : 0) || value > 2147483647) invalid(`Campo inválido: ${key}`);
      data[key] = value;
    } else if (rule === 'role') {
      if (!['CLIENTE','ADMIN_GENERAL','ADMIN_RESTAURANTE'].includes(value)) invalid('Rol inválido');
      data[key] = value;
    } else if (rule === 'password') {
      if (typeof value !== 'string' || value.length < 12 || value.length > 1024 || value.includes('\0')) invalid('La contraseña requiere de 12 a 1024 caracteres');
      data[key] = value;
    } else if (rule === 'ids') {
      if (!Array.isArray(value) || value.length > 1000 || value.some(id => !Number.isInteger(id) || id < 1 || id > 2147483647) || new Set(value).size !== value.length) invalid('Asignaciones inválidas');
      data[key] = [...value].sort((a,b) => a-b);
    }
  }
  if (creating) {
    for (const key of required[resource]) if (!Object.hasOwn(data,key)) invalid(`Campo requerido: ${key}`);
    data.activo ??= true;
    if (resource === 'usuarios') { data.rol ??= 'CLIENTE'; data.restaurantes ??= []; }
    if (resource === 'productos') { data.disponible ??= true; data.destacado ??= false; }
  }
  return data;
}
export function assertAdminScope(user, restaurantId, resource, creating = false) {
  if (!user || user.activo !== true) throw new AdminError(401,'Se requiere iniciar sesión');
  if (user.rol === 'ADMIN_GENERAL') return;
  if (user.rol !== 'ADMIN_RESTAURANTE' || resource === 'usuarios' || (resource === 'restaurantes' && creating)
    || (restaurantId != null && !(user.restaurantes ?? []).includes(restaurantId))) throw new AdminError(403,'Acceso denegado');
}
const imageRoot = fileURLToPath(new URL('../../../frontend/public/legacy/imagenes/', import.meta.url));
export async function validateRasterFile(candidate) {
  const file = await open(candidate,'r');
  try {
    const metadata = await file.stat();
    if (!metadata.isFile() || metadata.size < 4 || metadata.size > 5 * 1024 * 1024) invalid('La fotografía debe pesar como máximo 5 MiB');
    const buffer = Buffer.alloc(12);
    const {bytesRead} = await file.read(buffer,0,buffer.length,0);
    const ext = path.extname(candidate).toLowerCase();
    const jpeg = ['.jpg','.jpeg'].includes(ext) && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
    const png = ext === '.png' && bytesRead >= 8 && buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp = ext === '.webp' && bytesRead >= 12 && buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP';
    if (!jpeg && !png && !webp) invalid('Formato de fotografía inválido: usa JPG, PNG o WebP');
  } finally { await file.close(); }
}
export async function validateAdminPhoto(photo, restaurantId) {
  if (photo == null || photo === '') return;
  if (typeof photo !== 'string' || photo.length > 200) invalid('Fotografía inválida');
  const prefix = `/static/legacy/imagenes/cod${restaurantId}/`;
  const filename = photo.startsWith(prefix) ? photo.slice(prefix.length) : photo;
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*\.(?:jpe?g|png|webp)$/i.test(filename) || filename.includes('..')) invalid('Fotografía inválida para este restaurante');
  try {
    const images = await realpath(imageRoot);
    const root = await realpath(path.join(imageRoot,`cod${restaurantId}`));
    const candidate = await realpath(path.join(root,filename));
    if (path.dirname(root) !== images || path.dirname(candidate) !== root) invalid('Fotografía inválida');
    await validateRasterFile(candidate);
  } catch (error) {
    if (error instanceof AdminError) throw error;
    invalid('La fotografía debe existir en el restaurante');
  }
}
export function adminId(value) {
  const id = parseRestaurantId(value);
  if (!id) invalid('Identificador inválido');
  return id;
}
async function authorizedRecord(db, resource, id, user, lock = false) {
  assertAdminScope(user,null,resource);
  const record = await getAdminRecord(db,resource,id,lock);
  if (!record) throw new AdminError(404,'Registro no encontrado');
  assertAdminScope(user,record.restaurante_id,resource);
  return record;
}
function storageData(resource, data) {
  const result = {...data};
  if (Object.hasOwn(result,'activo')) {
    if (resource === 'usuarios') result.estado = result.activo ? '1' : '0';
    else {
      result[resource === 'cartas' ? 'eliminada' : 'eliminado'] = result.activo ? null : new Date();
      if (resource !== 'restaurantes') result.visible = result.activo;
    }
    delete result.activo;
  }
  return result;
}
export function createAdminService(db) {
  return {
    async list(resource,user) { assertAdminScope(user,null,resource); return listAdminRecords(db,resource,user); },
    async get(resource,id,user) { return authorizedRecord(db,resource,id,user); },
    async dashboard(user) { assertAdminScope(user,null,'dashboard'); return adminDashboard(db,user); },
    async save(resource,id,body,user) {
      const creating = id == null;
      assertAdminScope(user,null,resource,creating);
      const input = validateAdminInput(resource,body,creating);
      // Hash antes de adquirir locks para no mantenerlos durante el trabajo Argon2id.
      if (input.password) {
        input.password_hash = await argon2.hash(input.password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
        input.requiere_cambio_password = false;
        delete input.password;
      }
      return withAdminTransaction(db,async client => {
        const actor = await lockAdminActor(client,user.id);
        assertAdminScope(actor,null,resource,creating);
        const current = creating ? null : await authorizedRecord(client,resource,id,actor,true);
        let restaurantId = current?.restaurante_id;
        const relation = {cartas:['restautantes_id','restaurantes'],categorias:['cartas_id','cartas'],productos:['categorias_id','categorias']}[resource];
        if (relation) {
          const parent = await authorizedRecord(client,relation[1],input[relation[0]] ?? current[relation[0]],actor,true);
          restaurantId = parent.restaurante_id;
        }
        if (resource === 'usuarios') {
          const ids = input.restaurantes ?? current?.restaurantes ?? [];
          if ((await lockRestaurants(client,ids)).length !== ids.length) invalid('Restaurante asignado inexistente');
          const email = input.email ?? current?.email;
          if (email && await emailExists(client,email,id)) throw new AdminError(409,'El email ya está registrado');
        }
        if (resource !== 'usuarios' && restaurantId != null && (Object.hasOwn(input,'foto') || restaurantId !== current?.restaurante_id)) {
          await validateAdminPhoto(Object.hasOwn(input,'foto') ? input.foto : current?.foto,restaurantId);
        }
        if (current && restaurantId !== current.restaurante_id && ['cartas','categorias'].includes(resource)) {
          for (const child of await descendantPhotos(client,resource,id)) await validateAdminPhoto(child.foto,restaurantId);
        }
        const saved = await saveAdminRecord(client,resource,storageData(resource,input),id);
        if (resource === 'restaurantes' && creating) await validateAdminPhoto(input.foto,saved.restaurante_id);
        return saved;
      });
    }
  };
}
