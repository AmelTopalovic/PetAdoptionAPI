const debug = require('debug')('app:routes:api:pet');
const debugError = require('debug')('app:error');
const express = require('express');
const { nanoid } = require('nanoid');
const dbModule = require('../../database');
const {newId} = require('../../database')

// const petsArray = [
//   { _id: '1', name: 'Fido', createdDate: new Date() },
//   { _id: '2', name: 'Watson', createdDate: new Date() },
//   { _id: '3', name: 'Loki', createdDate: new Date() },
// ];

//create a router
const router = express.Router();

//define routes
router.get('/api/pet/list', async (req, res, next) => {
  try {
    const pets = await dbModule.findAllPets();
    res.json(pets);
  } catch (err) {
    next(err);
  }
});

router.get('/api/pet/:petId', async (req, res, next) => {
  try {
    const petId = newId(req.params.petId);
    const pet = await dbModule.findPetById(petId);
    if (!pet) {
      res.status(404).json({ error: ` ${petId} Pet not found` });
    } else {
      res.json(pet);
    }
  } catch (err) {
    next(err);
  }
});
//create
router.put('/api/pet/new', async (req, res, next) => {
  try {
      const pet = {
      _id: newId(),
      species: req.body.species,
      name: req.body.name,
      age: parseInt(req.body.age),
      gender: req.body.gender,
      createdDate: new Date(),

    };

  //validation
  if (!pet.species) {
    res.status(400).json({ error: 'Species required' });
  } else if (!pet.name) {
    res.status(400).json({ error: 'Name required' });
  } else if (!pet.age) {
    res.status(400).json({ error: 'Age required' });
  } else if (!pet.gender) {
    res.status(400).json({ error: 'Gender required' });
  } else {
    await dbModule.insertOnePet(pet);
    res.json({ message: 'Pet created' });
  }
  } catch (err) {
    next(err);
  }
});
//update
router.put('/api/pet/:petId', async (req, res, next) => {
  try{
    const petId = newId(req.params.petId);
    const update = req.body;
    debug(`update pet ${petId}`, update);

    const pet = await dbModule.findPetById(petId);
    if (!pet) {
      res.status(404).json({ error: ` ${petId} Pet not found` });
    } else {
      await dbModule.updateOnePet(petId, update);
      res.json({ message: ` ${petId} Pet updated` });
    }
  } catch (err) {
    next(err);
  }
});

//delete
router.delete('/api/pet/:petId', async (req, res, next) => {
 try{
    const petId = newId(req.params.petId);
    debug(`Deleted pet: ${petId}`);

    const pet = await dbModule.findPetById(petId);
    if (!pet) {
      res.status(404).json({ error: ` ${petId} Pet not found` });
    } else {
      await dbModule.deleteOnePet(petId);
      res.json({ message: ` ${petId} Pet deleted` });
    }
  } catch (err) {
    next(err);
 }
});

//export router
module.exports = router;
