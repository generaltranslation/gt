'use client';

import { useState } from 'react';
import { Branch, Static, T, Var } from 'gt-next';

// Subjects
const getFourthSubject = () => "Lily"
function getThirdSubject(subject: string) {
  function fakeSubject() {
    if (1) {
      return 'fake subject 1'
    } else {
      return 'fake subject 2'
    }
  }
  if (subject === 'Lily') {
    return getFourthSubject();
  } else {
    return <Var>{subject}</Var>;
  }
}

const getSecondSubject = (subject: string) => {
  const fakeSubject = () => {
    if (1) {
      return 'fake subject 1'
    } else {
      return 'fake subject 2'
    }
  }
  if (subject === 'Ernest') {
    return 'Ernest';
  } else if (subject === 'Fernanda') {
    return <>Fernanda</>;
  } else {
    return (
      <>
        The beautiful <Static>{getThirdSubject(subject)}</Static>
      </>
    );
  }
}

function getSubjectName(subject: string) {
  if (subject === 'Archie') {
    return 'Archie';
  } else {
    return getSecondSubject(subject);
  }
}

// Predicates
function getThirdPredicate(predicate: string) {
  if (predicate === 'was') {
    return 'was';
  }
  {
    return <Var>{predicate}</Var>;
  }
}

function getSecondPredicate(predicate: string) {
  if (predicate === 'would have been') {
    return <>would have been</>;
  } else {
    return getThirdPredicate(predicate);
  }
}

function getPredicate(predicate: string) {
  if (predicate === 'is') {
    return 'is';
  } else {
    return getSecondPredicate(predicate);
  }
}

// Objects
function getThirdObject(object: string) {
  if (object === 'a sculptor') {
    return <>a sculptor</>;
  } else {
    return (
      <>
        a{' '}
        <Branch
          branch={Math.random() > 0.5}
          true='cool person'
          false={<>person</>}
        />
      </>
    );
  }
}

function getSecondObject(object: string) {
  if (object === 'a famous person') {
    return <>a famous person</>;
  } else {
    return getThirdObject(object);
  }
}

function getObject(object: string) {
  if (object === 'a painter') {
    return <>a painter</>;
  } else {
    return getSecondObject(object);
  }
}

export default function Page() {
  const [subject, setSubject] = useState('Archie');
  const [predicate, setPredicate] = useState('is');
  const [object, setObject] = useState('a person');

  // All possible values
  const subjects = ['Archie', 'Ernest', 'Fernanda', 'Lily', 'Brian'];
  const predicates = ['is', 'would have been', 'was', 'wants to be'];
  const objects = [
    'a painter',
    'a famous person',
    'a sculptor',
    'a person',
    'a cool person',
  ];

  // Enumerate every possible combination on button press
  const handleEnumerate = () => {
    // Generate all combinations
    const combinations: Array<[string, string, string]> = [];
    for (const subj of subjects) {
      for (const pred of predicates) {
        for (const obj of objects) {
          combinations.push([subj, pred, obj]);
        }
      }
    }

    // Cycle through each combination, waiting for next render cycle
    let index = 0;
    const processNext = () => {
      if (index < combinations.length) {
        const [subj, pred, obj] = combinations[index];
        setSubject(subj);
        setPredicate(pred);
        setObject(obj);
        index++;
        requestAnimationFrame(processNext);
      }
    };
    requestAnimationFrame(processNext);
  };

  return (
    <>
      <div>
        <button onClick={handleEnumerate}>Enumerate All Combinations</button>
      </div>
      <T>
        <Static>{getSubjectName(subject)}</Static>{' '}
        <Static>{getPredicate(predicate)}</Static>{' '}
        <Static>{getObject(object)}</Static>
      </T>
    </>
  );
}
