import { T, Var } from 'gt-react';
export default function TestEdgeCases() {
  const t = 2;
  return <div>{true ? `#${t}` : <span></span>}</div>;
}
export function Home() {
  const temp = 'Hello World!';

  const test1 = (
    <T id='testedgecases.1'>
      <div>Hello World!</div>
    </T>
  );
  const test2 = (
    <T id='testedgecases.2'>
      <p>Hello World!</p>
    </T>
  );
  const test3 = <p>{true && <T id='testedgecases.3'>{'true'}</T>}</p>;
  const test4 = <div>{test2}</div>;
  const test5 = (
    <div>
      {true ? (
        <T id='testedgecases.4'>{'true'}</T>
      ) : (
        <T id='testedgecases.5'>{'false'}</T>
      )}
    </div>
  );
  const test6 = (
    <div>
      {true ? (
        <T id='testedgecases.6'>
          <div>true</div>
        </T>
      ) : (
        <div>{temp}</div>
      )}
    </div>
  );
  return (
    <T id='testedgecases.36'>
      <div>
        <p>Hello World!</p>
        <p>{'Hello World!'}</p>
        <p>{'Hello,' + ' World!'}</p>
        <div>
          <p>Hello World!</p>
        </div>
        <p>{3 + 3}</p>
        <p>{3 + '3'}</p>
        <p>{3}</p>
        <p>{`${3}`}</p>
        <p>{`${temp}`}</p>
        <p>
          <Var>{`${temp}` + 3}</Var>
        </p>
        <p>{`3`}</p>
        <p>{`3` + 3}</p>
        <p>
          <Var>{true && <T id='testedgecases.7'>{'true'}</T>}</Var>
        </p>
        <p>
          <Var>{true || <T id='testedgecases.8'>{'true'}</T>}</Var>
        </p>
        <p>
          <Var>
            {true ? (
              <T id='testedgecases.9'>{'true'}</T>
            ) : (
              <T id='testedgecases.10'>{'false'}</T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {true ? (
              true ? (
                <T id='testedgecases.11'>{'true'}</T>
              ) : (
                <T id='testedgecases.12'>{'false'}</T>
              )
            ) : (
              <T id='testedgecases.13'>{'false'}</T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {true ? (
              true ? (
                <T id='testedgecases.14'>{'true'}</T>
              ) : (
                <T id='testedgecases.15'>{'false'}</T>
              )
            ) : true ? (
              <T id='testedgecases.16'>{'true'}</T>
            ) : (
              <T id='testedgecases.17'>{'false'}</T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {true && (
              <T id='testedgecases.18'>
                <p>true</p>
              </T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {true || (
              <T id='testedgecases.19'>
                <p>true</p>
              </T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {true ? (
              <T id='testedgecases.20'>
                <p>true</p>
              </T>
            ) : (
              <T id='testedgecases.21'>
                <p>false</p>
              </T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {true ? (
              true ? (
                <T id='testedgecases.22'>
                  <p>true</p>
                </T>
              ) : (
                <T id='testedgecases.23'>
                  <p>false</p>
                </T>
              )
            ) : (
              <T id='testedgecases.24'>
                <p>false</p>
              </T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {true ? (
              true ? (
                <T id='testedgecases.25'>
                  <p>true</p>
                </T>
              ) : (
                <T id='testedgecases.26'>
                  <p>false</p>
                </T>
              )
            ) : true ? (
              <T id='testedgecases.27'>
                <p>true</p>
              </T>
            ) : (
              <T id='testedgecases.28'>
                <p>false</p>
              </T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {<T id='testedgecases.29'>{'hello'}</T> || (
              <T id='testedgecases.30'>{'true'}</T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {<T id='testedgecases.31'>{'hello'}</T> ?? (
              <T id='testedgecases.32'>{'true'}</T>
            )}
          </Var>
        </p>
        <p>
          <Var>{'hello' && <T id='testedgecases.33'>{'true'}</T>}</Var>
        </p>
        <p>
          <Var>{'hello' && <T id='testedgecases.34'>{'true'}</T>}</Var>
        </p>
        <p>
          <Var>{'hello' && <T id='testedgecases.35'>{'true'}</T>}</Var>
        </p>
      </div>
    </T>
  );
}
