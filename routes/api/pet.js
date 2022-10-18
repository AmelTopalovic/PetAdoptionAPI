const debug = require('debug')('app:routes:api:pet');
const debugError = require('debug')('app:error');
const express = require('express');
const { nanoid } = require('nanoid');
const dbModule = require('../../database');
const {
  newId,
  connect,
  findAllPets,
  findPetById,
  insertOnePet,
  updateOnePet,
  deleteOnePet,
  saveEdit,
} = require('../../database');
const { MongoClient, ObjectId } = require('mongodb');
const Joi = require('joi');
const validId = require('../../middleware/validId');
const validBody = require('../../middleware/validBody');

// const petsArray = [
//   { _id: '1', name: 'Fido', createdDate: new Date() },
//   { _id: '2', name: 'Watson', createdDate: new Date() },
//   { _id: '3', name: 'Loki', createdDate: new Date() },
// ];

const newPetSchema = Joi.object({
  species: Joi.string()
    .trim()
    .min(1)
    .pattern(/^[^0-9]+$/, 'not numbers')
    .required(),
  name: Joi.string().trim().min(1).required(),
  age: Joi.number().integer().min(0).max(1000).required(),
  gender: Joi.string().trim().length(1).required(),
});

const updatePetSchema = Joi.object({
  species: Joi.string()
    .trim()
    .min(1)
    .pattern(/^[^0-9]+$/, 'not numbers'),
  name: Joi.string().trim().min(1),
  age: Joi.number().integer().min(0).max(1000),
  gender: Joi.string().trim().length(1),
});

//create a router
const router = express.Router();

//define routes
router.get('/list', async (req, res, next) => {
  try {

    //get inputs
    let { keywords, species, minAge, maxAge, sortBy, pageNumber, pageSize } = req.query;

    debug(req.query);
   
    //match stage
    const match = {};
    if(keywords) {
      match.$text = { $search: keywords};
    }
    if(species) {
      match.species = { $eq: species};
    }

    minAge = parseInt(minAge);
    maxAge = parseInt(maxAge);

    if(minAge && maxAge) {
      match.age = { $gte: minAge, $lte: maxAge};
    } else if(minAge) {
      match.age = { $gte: minAge};
    } else if(maxAge) {
      match.age = { $lte: maxAge};
    }
    //sort
    let sort = {name: 1, createdDate: 1};
    switch (sortBy) {
      case 'species': sort = {species: 1, name: 1, createdDate: 1}; break;
      case 'speciesDesc': sort = {species: -1, name: 1, createdDate: 1}; break;
      case 'name': sort = {name: 1, createdDate: 1}; break;
      case 'nameDesc': sort = {name: -1, createdDate: -1}; break;
      case 'age': sort = {age: 1,createdDate: 1}; break;
      case 'ageDesc': sort = {age: -1,createdDate: -1}; break;
      case 'gender': sort = {gender: 1, name: 1, createdDate: 1}; break;
      case 'genderDesc': sort = {gender: -1, name: -1, createdDate: -1}; break;
      case 'newest': sort = {createdDate: -1}; break;
      case 'oldest': sort = {createdDate: 1}; break;
    }
    //project stage
    const project = {species: 1, name: 1, age: 1, gender: 1, createdBy: 1, createdOn: 1, lastUpdatedBy: 1, lastUpdated: 1};

    //skip and limit stages
    pageNumber = parseInt(pageNumber) || 1;
    pageSize= parseInt(pageSize) || 5;
    const skip = (pageNumber -1) * pageSize;
    const limit = pageSize;

    //pipeline
    const pipeline = [
      { $match: match },
      { $sort: sort },
      { $project: project },
      { $skip: skip },
      { $limit: limit },
    ];

    //get db
    const db = await connect();
    const cursor = db.collection('pets').aggregate(pipeline);
    const results = await cursor.toArray();

    res.json(results);
  } catch (err) {
    next(err);
  }
router.get('/:petId', validId('petId'), async (req, res, next) => {
  try {
    petId = newId(req.params.petId);
  } catch (err) {
    return res.status(400).json({
      error: 'petId was not a valid ObjectId',
    });
  }

  try {
    const petId = req.petId;
    const pet = await findPetById(petId);
    if (!pet) {
      res.status(404).json({
        error: ` ${petId} Pet not found`,
      });
    } else {
      res.json(pet);
    }
  } catch (err) {
    next(err);
  }
});
//create
router.put('/new', validBody(newPetSchema), async (req, res, next) => {
  try {
    const petId = newId();
      const pet = {
        ...req.body,
        _id: petId,
        createdOn: new Date(),
      };
      debug(`insert pet ${petId}:`, pet);

      // insert pet document
      const insertResult = await insertOnePet(pet);
      debug('insert result:', insertResult);

      // save edit for audit trail
      const edit = {
        timestamp: new Date(),
        op: 'insert',
        col: 'pets',
        target: { petId },
        update: pet,
        auth: req.auth,
      };
      await saveEdit(edit);
      debug('edit saved');

      // send response
      res.json({ message: 'Pet inserted.', petId });
    } catch (err) {
      next(err);
  }
});
//update
router.put('/:petId', validId('petId'), validBody(updatePetSchema), async (req, res, next) => {
  try {
    const petId = req.petId;
      const update = req.body;

   
      debug(`update pet ${petId}:`, update);

      // update pet document
      const updateResult = await updateOnePet(petId, update);
      debug('update result:', updateResult);

      // save edit for audit trail
      const edit = {
        timestamp: new Date(),
        op: 'update',
        col: 'pets',
        target: { petId },
        update,
        auth: req.auth,
      };
      await saveEdit(edit);
      debug('edit saved');

      // send response
      if (updateResult.matchedCount > 0) {
        res.json({ message: 'Pet Updated!', petId });
      } else {
        res.status(404).json({ error: 'Pet not found!' });
      }
    } catch (err) {
      next(err);
  }
});

//delete
router.delete('/:petId', validId('petId'), async (req, res, next) => {
  try {
    const petId = req.petId;
      debug(`delete pet ${petId}`);

      // delete pet document
      const deleteResult = await deleteOnePet(petId);
      debug('delete result:', deleteResult);

      // save edit for audit trail
      const edit = {
        timestamp: new Date(),
        op: 'delete',
        col: 'pets',
        target: { petId },
        auth: req.auth,
      };
      await saveEdit(edit);
      debug('edit saved');

      // send response
      res.json({ message: 'Pet Deleted!', petId });
    } catch (err) {
      next(err);
  }
  });
});

//export router
module.exports = router;
